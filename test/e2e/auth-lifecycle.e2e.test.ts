import {expect} from 'chai'
import {execFile} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {promisify} from 'node:util'

import {deleteRepo, RUN_PREFIX, seedRepo} from './fixtures.js'
import {createConfigDir, redactSecret, removeConfigDir, requireEnv, runCliJson, runCliOk} from './helpers.js'

const execFileAsync = promisify(execFile)

type Profile = {apiToken?: string; email?: string; host?: string}
type StoredConfig = {defaultProfile?: string; profiles: Record<string, Profile>}

/** Bitbucket Cloud, the host an omitted `-u, --host` must store. */
const CLOUD_HOST = 'https://bitbucket.org'
/** A non-Cloud value, to prove an explicit host is stored verbatim. */
const CUSTOM_HOST = 'https://bb.internal.example'

/**
 * Reads one field of one stored profile.
 *
 * Tests never dump whole credential-bearing profile objects: each assertion
 * names a single field, so a failing expectation can only render that field.
 *
 * @param configDir The dir holding bb-config.json.
 * @param profile The profile to read.
 * @param field The field to read.
 * @returns The field's value, or undefined when the profile lacks it.
 */
async function readProfileField<K extends keyof Profile>(
  configDir: string,
  profile: string,
  field: K,
): Promise<Profile[K]> {
  const stored = JSON.parse(await fs.readFile(path.join(configDir, 'bb-config.json'), 'utf8')) as StoredConfig
  return stored.profiles[profile]?.[field]
}

describe('e2e: auth lifecycle', () => {
  const configDirs: string[] = []
  const cloneDirs: string[] = []
  let fixtureSlug: string | undefined

  after(async () => {
    await Promise.all(configDirs.map((dir) => removeConfigDir(dir)))
    await Promise.all(cloneDirs.map((dir) => fs.rm(dir, {force: true, recursive: true})))

    if (fixtureSlug) await deleteRepo(fixtureSlug)
  })

  /**
   * Creates a throwaway config dir, fresh per independent case, holding a
   * single host-less profile pointing at Bitbucket Cloud.
   *
   * The shared fixture (createConfigDir) keeps its own host-less profiles;
   * these per-case dirs exist so an `auth` write here can never disturb the
   * other suites or cases.
   *
   * @param profile The profile name to write.
   * @returns The config dir, removed by the suite's teardown.
   */
  async function createHostlessConfigDir(profile: string): Promise<string> {
    const {apiToken, email} = requireEnv()
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bb-e2e-auth-lifecycle-'))
    configDirs.push(dir)
    await fs.writeFile(
      path.join(dir, 'bb-config.json'),
      JSON.stringify({defaultProfile: profile, profiles: {[profile]: {apiToken, email}}}, null, 2),
      {mode: 0o600},
    )

    return dir
  }

  /**
   * Creates a throwaway config dir with no config file at all, for `auth add`
   * cases: the command must create the file itself.
   *
   * @returns The config dir, removed by the suite's teardown.
   */
  async function createEmptyConfigDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bb-e2e-auth-lifecycle-'))
    configDirs.push(dir)

    return dir
  }

  it('stores the Bitbucket Cloud host when -u is omitted and the profile authenticates', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'added-without-host'
    const dir = await createEmptyConfigDir()

    await runCliOk(['bb', 'auth', 'add', '-p', profile, '-e', email, '-t', apiToken], dir)

    expect(await readProfileField(dir, profile, 'host')).to.equal(CLOUD_HOST)
    expect(await readProfileField(dir, profile, 'email')).to.equal(email)
    // Never assert the token's value: a failing assertion would print it.
    expect(await readProfileField(dir, profile, 'apiToken')).to.be.a('string').and.not.empty

    // The stored default host must not change routing: the profile still
    // authenticates and performs a read-only Cloud API call.
    const test = await runCliJson<{success: boolean}>(['bb', 'auth', 'test', '-p', profile, '--json'], dir)
    expect(test.success, 'auth test failed for the default-host profile').to.be.true
    const listed = await runCliJson<{data: {values: Array<{workspace: {slug: string}}>}; success: boolean}>(
      ['bb', 'workspace', 'list', '-p', profile],
      dir,
    )
    expect(listed.success, 'workspace list failed for the default-host profile').to.be.true
    expect(listed.data.values.map((membership) => membership.workspace.slug)).to.include(process.env.E2E_WORKSPACE)
  })

  it('stores an explicit host verbatim, preserves it on update, then overwrites it', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'explicit-host'
    const dir = await createEmptyConfigDir()

    await runCliOk(['bb', 'auth', 'add', '-p', profile, '-e', email, '-t', apiToken, '-u', CUSTOM_HOST], dir)
    expect(await readProfileField(dir, profile, 'host')).to.equal(CUSTOM_HOST)

    // The custom-host profile must also authenticate: the stored host is
    // metadata and never changes where API calls go.
    const test = await runCliJson<{success: boolean}>(['bb', 'auth', 'test', '-p', profile, '--json'], dir)
    expect(test.success, 'auth test failed for the custom-host profile').to.be.true
    const listed = await runCliJson<{success: boolean}>(['bb', 'workspace', 'list', '-p', profile], dir)
    expect(listed.success, 'workspace list failed for the custom-host profile').to.be.true

    // Omission on update keeps what is stored — it does not reset it to the default.
    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken], dir)
    expect(await readProfileField(dir, profile, 'host')).to.equal(CUSTOM_HOST)

    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken, '-u', CLOUD_HOST], dir)
    expect(await readProfileField(dir, profile, 'host')).to.equal(CLOUD_HOST)
  })

  it('stores the fallback host when updating a host-less profile without -u', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'hostless-updated'
    const dir = await createHostlessConfigDir(profile)
    expect(await readProfileField(dir, profile, 'host')).to.be.undefined

    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken], dir)

    expect(await readProfileField(dir, profile, 'host')).to.equal(CLOUD_HOST)
    expect(await readProfileField(dir, profile, 'email')).to.equal(email)
  })

  it('keeps reading with an untouched host-less profile', async () => {
    // The shared fixture's `default` profile has no stored host and is never
    // written by this suite: it must keep working without a migration.
    const {workspace} = requireEnv()
    const sharedDir = await createConfigDir()
    configDirs.push(sharedDir)
    expect(await readProfileField(sharedDir, 'default', 'host')).to.be.undefined

    const test = await runCliJson<{success: boolean}>(['bb', 'auth', 'test', '--json'], sharedDir)
    expect(test.success).to.be.true

    const listed = await runCliJson<{data: {values: Array<{workspace: {slug: string}}>}; success: boolean}>(
      ['bb', 'workspace', 'list'],
      sharedDir,
    )
    expect(listed.success).to.be.true
    expect(listed.data.values.map((membership) => membership.workspace.slug)).to.include(workspace)
  })

  // The stored host must not leak into git routing: an https clone always uses
  // the API-declared Cloud URL and the Cloud credential host, whatever the
  // profile holds. One clone per profile shape, against a private fixture repo.
  it('clones over https with host-less, Cloud-default and custom-host profiles', async () => {
    const {apiToken, email, workspace} = requireEnv()
    const seeded = await seedRepo('auth-lifecycle-clone')
    fixtureSlug = seeded.slug

    const hostlessDir = await createHostlessConfigDir('clone-hostless')
    const defaultDir = await createEmptyConfigDir()
    const customDir = await createEmptyConfigDir()
    await runCliOk(['bb', 'auth', 'add', '-p', 'clone-cloud', '-e', email, '-t', apiToken], defaultDir)
    await runCliOk(
      ['bb', 'auth', 'add', '-p', 'clone-custom', '-e', email, '-t', apiToken, '-u', CUSTOM_HOST],
      customDir,
    )

    const shapes: Array<{configDir: string; label: string; profile: string}> = [
      {configDir: hostlessDir, label: 'host-less', profile: 'clone-hostless'},
      {configDir: defaultDir, label: 'Cloud default', profile: 'clone-cloud'},
      {configDir: customDir, label: 'custom host', profile: 'clone-custom'},
    ]

    for (const {configDir: dir, label, profile} of shapes) {
      // eslint-disable-next-line no-await-in-loop
      const parent = await fs.mkdtemp(path.join(os.tmpdir(), `bb-e2e-${RUN_PREFIX}clone-`))
      cloneDirs.push(parent)
      const destination = path.join(parent, 'repo')

      // Sequential on purpose: three concurrent clones of the same repository
      // interleave their progress output for no gain.
      // eslint-disable-next-line no-await-in-loop
      await runCliOk(['bb', 'repo', 'clone', workspace, seeded.slug, destination, '-p', profile], dir)

      // eslint-disable-next-line no-await-in-loop
      const {stdout: worktree} = await execFileAsync('git', ['-C', destination, 'rev-parse', '--is-inside-work-tree'])
      expect(worktree.trim(), `${label} profile did not produce a worktree`).to.equal('true')

      // The persisted remote must stay a credential-free Bitbucket Cloud URL:
      // credentials go to the scoped helper only, never into `.git/config`.
      // eslint-disable-next-line no-await-in-loop
      const {stdout: remote} = await execFileAsync('git', ['-C', destination, 'remote', 'get-url', 'origin'])
      const url = remote.trim()
      expect(url, `${label} profile stored a non-Cloud remote: ${redactSecret(url, apiToken)}`).to.match(
        /^https:\/\/bitbucket\.org\//,
      )
      expect(url, `${label} profile stored credentials in the remote URL`).to.not.include('@')
      expect(url, `${label} profile stored the API token in the remote URL`).to.not.include(apiToken)
    }
  })
})
