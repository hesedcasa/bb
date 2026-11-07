import {type ApiResult, type AuthConfig, createProfileManager, type Profiles} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'
import {Buffer} from 'node:buffer'
import path from 'node:path'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getCurrentUser, getRepository} from '../../../bitbucket/bitbucket-client.js'
import {cloneRepository, type GitCloneCredentials} from '../../../git-clone.js'

type CloneProtocol = 'https' | 'ssh'

/**
 * Why the authentication config lookup produced nothing.
 *
 * `loadAuthConfig` returns undefined both for a genuinely absent config and
 * for a broken one (plugin-lib swallows parse and secret-resolution errors),
 * so the raw profile file is inspected to keep corruption and unresolved
 * secrets classified as errors instead of anonymous fallbacks.
 */
type MissingAuthState = 'absent' | 'missing-profile' | 'unusable'

const PLUGIN_LIB_MISSING_PROFILES_MESSAGE = 'No authentication profiles found'

async function classifyMissingAuth(
  manager: {getDefaultProfile: () => Promise<string>; readProfiles: () => Promise<Profiles>},
  selectedProfile: string | undefined,
): Promise<MissingAuthState> {
  let profiles: Profiles
  try {
    profiles = await manager.readProfiles()
  } catch (error: unknown) {
    // ENOENT is reported by plugin-lib with this fixed message; anything else
    // means the config file exists but cannot be parsed.
    return error instanceof Error && error.message === PLUGIN_LIB_MISSING_PROFILES_MESSAGE ? 'absent' : 'unusable'
  }

  let name: string
  try {
    name = selectedProfile ?? (await manager.getDefaultProfile())
  } catch {
    return 'absent'
  }

  return name in profiles ? 'unusable' : 'missing-profile'
}

/**
 * Select and validate the clone URL from the repository's `links.clone`.
 *
 * The URL always comes from the API response — it is never constructed from
 * the workspace/slug. HTTPS hrefs must be https on the Bitbucket Cloud host
 * with no query/fragment and no password; API-supplied username userinfo is
 * stripped so the persisted remote stays credential-free. SSH hrefs must be
 * Bitbucket scp-style or ssh:// URLs — never local paths, external-helper
 * syntax, or option-like strings.
 */
function extractCloneHref(data: unknown, protocol: CloneProtocol): string {
  const cloneLinks = (data as null | undefined | {links?: {clone?: unknown}})?.links?.clone
  if (!Array.isArray(cloneLinks)) {
    throw new TypeError('Repository lookup returned no clone links.')
  }

  const entry = cloneLinks.find((link) => (link as null | {name?: unknown})?.name === protocol)
  const href = (entry as undefined | {href?: unknown})?.href
  if (typeof href !== 'string' || href.trim() === '') {
    throw new Error(`Repository lookup returned no ${protocol} clone URL.`)
  }

  if (protocol === 'https') {
    return validateHttpsHref(href)
  }

  return validateSshHref(href)
}

const BITBUCKET_HOST_PATTERN = /(?:^|\.)bitbucket\.org$/

function validateHttpsHref(href: string): string {
  let parsed: URL
  try {
    parsed = new URL(href)
  } catch {
    throw new Error('The repository https clone URL is not a valid URL.')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('The repository https clone URL must use https.')
  }

  if (!BITBUCKET_HOST_PATTERN.test(parsed.hostname)) {
    throw new Error(`The repository https clone URL points at an unexpected host '${parsed.hostname}'.`)
  }

  if (parsed.username !== '') {
    // The API sometimes embeds the account name as userinfo; it is not
    // authentication and must not reach the persisted remote URL.
    parsed.username = ''
  }

  if (parsed.password !== '') {
    throw new Error('The repository https clone URL unexpectedly contains a password.')
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error('The repository https clone URL unexpectedly contains a query or fragment.')
  }

  return parsed.href
}

function validateSshHref(href: string): string {
  if (href.startsWith('ssh://')) {
    let parsed: URL
    try {
      parsed = new URL(href)
    } catch {
      throw new Error('The repository ssh clone URL is not a valid URL.')
    }

    if (parsed.protocol !== 'ssh:' || !BITBUCKET_HOST_PATTERN.test(parsed.hostname)) {
      throw new Error('The repository ssh clone URL must target the Bitbucket Cloud ssh host.')
    }

    return parsed.href
  }

  // scp-style syntax: user@host:path — everything else (local paths,
  // `ext::`-style helper syntax, option-like strings) is rejected.
  const scpPattern = /^[\w.~-]+@(?:[\w.-]+\.)*bitbucket\.org:[\w.~/-]+$/
  if (!scpPattern.test(href)) {
    throw new Error('The repository ssh clone URL is not a valid Bitbucket ssh URL.')
  }

  return href
}

/** Defensively strip profile credentials from any message before emitting it. */
function sanitizeErrorMessage(error: unknown, auth: AuthConfig | undefined): string {
  const message = error instanceof Error ? error.message : String(error)
  if (!auth?.apiToken) {
    return message
  }

  const basic = Buffer.from(`${auth.email ?? ''}:${auth.apiToken}`).toString('base64')
  let redacted = message
  for (const secret of [auth.apiToken, encodeURIComponent(auth.apiToken), basic]) {
    if (secret.length > 0) {
      redacted = redacted.split(secret).join('[REDACTED]')
    }
  }

  return redacted
}

export default class RepoClone extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    destination: Args.string({
      description: 'Destination directory (defaults to the repository slug)',
      required: false,
    }),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = `Clone a repository with non-interactive, profile-based authentication

Uses the repository's API-declared clone URL and shells out to the local git binary. With a configured profile (default for https), the profile's API token authenticates the clone: the Bitbucket account name is resolved with GET /2.0/user (the git endpoint does not accept the profile email as a username) and the credentials are handed to the spawned git process only — never to argv, output, or the persisted remote URL. Requires Git 2.31 or newer for authenticated https clones.

--protocol ssh performs no credential injection: your ssh agent and keys apply. Without any configured profile, an anonymous API lookup is attempted (works for publicly discoverable repositories only) and, for https, a plain git clone runs with git's own authentication.`
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo ~/src/my-repo',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --protocol ssh',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo -p work',
  ]

  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    protocol: Flags.string({
      default: 'https',
      description: 'Clone protocol (uses the API-declared clone URL for the protocol)',
      options: ['https', 'ssh'],
      required: false,
    }),
  }

  public override jsonEnabled(): boolean {
    return false
  }

  public async run(): Promise<void> {
    try {
      await this.runClone()
    } catch (error: unknown) {
      // Single sanitized failure surface: one {error} JSON object on stdout,
      // exit code 1, no duplicated human error text.
      this.logJson(this.toErrorJson(sanitizeErrorMessage(error, this.auth)))
      this.exit(1)
    }
  }

  // Held only for redaction while the command runs; never logged.
  private auth: AuthConfig | undefined

  private async runClone(): Promise<void> {
    const {args, flags} = await this.parse(RepoClone)
    const protocol: CloneProtocol = flags.protocol === 'ssh' ? 'ssh' : 'https'

    const {getDefaultProfile, loadAuthConfig, readProfiles} = createProfileManager(
      this.config,
      flags.profile,
      'bb-config.json',
    )
    const auth = await loadAuthConfig()
    this.auth = auth

    let credentials: GitCloneCredentials | undefined
    if (auth) {
      // The loaded profile always drives the API lookup; its credentials are
      // only injected for https. SSH relies on the user's ssh agent and keys.
      credentials = protocol === 'https' ? this.credentialsFrom(auth) : undefined
    } else {
      const state = await classifyMissingAuth({getDefaultProfile, readProfiles}, flags.profile)
      if (state === 'unusable') {
        throw new Error('Authentication config exists but could not be loaded.')
      }

      if (flags.profile) {
        throw new Error(`Profile '${flags.profile}' not found in authentication config.`)
      }

      // Genuinely absent default config: proceed anonymously. Private
      // repositories will typically not be discoverable without credentials.
      if (protocol === 'https') {
        this.warn(
          'No authentication profile configured — cloning without bb-supplied credentials; git will use its own authentication (which may prompt or fail for private repositories).',
        )
      }
    }

    let result: ApiResult
    try {
      result = await getRepository(auth, args.workspace, args.repoSlug)
      if (credentials && auth && result.success) {
        // Must run before clearClients(): it reuses the same cached client.
        credentials.username = await this.resolveGitUsername(auth)
      }
    } finally {
      clearClients()
    }

    if (!result.success) {
      throw new Error(
        `Failed to look up repository ${args.workspace}/${args.repoSlug}. Check the workspace, repository slug, and your credentials.`,
      )
    }

    const cloneUrl = extractCloneHref(result.data, protocol)
    if (credentials && protocol === 'https') {
      credentials.host = new URL(cloneUrl).host
    }

    const destination = path.resolve(process.cwd(), args.destination ?? args.repoSlug)
    await cloneRepository({credentials, destination, url: cloneUrl})
    this.log(destination)
  }

  /**
   * Resolve the Bitbucket account name to use as the git HTTP username.
   *
   * Bitbucket Cloud's git endpoint rejects the profile email as the username
   * (while the API accepts it), so the account name is resolved with
   * `GET /2.0/user`, which authenticates with the profile's email + API
   * token. If it cannot be resolved, the profile email is used as a
   * documented fallback and the clone may fail with a sanitized 401.
   */
  private async resolveGitUsername(auth: AuthConfig): Promise<string> {
    try {
      const user = await getCurrentUser(auth)
      const username = (user.data as null | {username?: unknown})?.username
      if (typeof username === 'string' && user.success && username.trim() !== '') {
        return username
      }
    } catch {
      // Fall through to the email fallback — never surface /user internals.
    }

    this.warn(
      'Could not resolve the Bitbucket account name for the profile — using the profile email as the git username; the clone may fail if Bitbucket rejects it.',
    )
    return auth.email ?? ''
  }

  private credentialsFrom(auth: AuthConfig): GitCloneCredentials {
    if (!auth.email) {
      throw new Error('The selected profile has no email address — required to authenticate an https clone.')
    }

    if (!auth.apiToken) {
      throw new Error('The selected profile has no API token — required to authenticate an https clone.')
    }

    // The email is the API-accepted username; resolveGitUsername() replaces
    // it with the Bitbucket account name that the git endpoint requires.
    return {host: 'bitbucket.org', password: auth.apiToken, username: auth.email}
  }
}
