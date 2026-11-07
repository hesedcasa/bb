import {Buffer} from 'node:buffer'
import {type ChildProcess, spawn} from 'node:child_process'
import {mkdtemp, rm} from 'node:fs/promises'
import {devNull, tmpdir} from 'node:os'
import path from 'node:path'

/**
 * Git execution support for `repo clone`
 *
 * Everything process-related lives here so the oclif command stays thin:
 * clone execution via `node:child_process.spawn` (never a shell), authenticated
 * child-environment construction, version validation, output redaction, and
 * child lifecycle handling.
 *
 * Credentials are delivered to the spawned `git` process only, through its
 * scoped environment:
 *
 * - Git's `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` env
 *   mechanism (git >= 2.31) installs a process-scoped `credential.helper`
 *   whose command string contains no secret — the helper reads the username
 *   and password from dedicated child-env variables.
 * - `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` point at the platform null device
 *   (plus `GIT_CONFIG_NOSYSTEM=1`), so inherited URL rewrites, authorization
 *   headers, credential managers, and tracing configuration cannot override
 *   the clean request.
 * - Nothing is read from the ambient environment (an explicit operational
 *   allowlist is used instead of spreading `process.env`), nothing lands in
 *   argv, and the URL stays clean, so the remote persisted in the clone's
 *   `.git/config` contains no secret.
 */

/** Minimum Git version supporting the GIT_CONFIG_* env config mechanism. */
export const MINIMUM_GIT_VERSION = {major: 2, minor: 31, patch: 0}

export interface GitCloneCredentials {
  /** HTTPS host the credentials are restricted to (e.g. `bitbucket.org`). */
  host: string
  /** Resolved API token (app password) used as the Git HTTP password. */
  password: string
  /** Account email used as the Git HTTP username. */
  username: string
}

export interface CloneRepositoryOptions {
  /** Clone URL taken from the API's `links.clone` — never credentials in it. */
  url: string
  /** Absolute destination directory for the clone. */
  destination: string
  /** Presence selects authenticated (isolated) mode; absence clones plainly. */
  credentials?: GitCloneCredentials
  /**
   * Output sink for streamed child output (defaults to process.stderr).
   * Everything is passed through a bounded streaming redactor either way.
   */
  write?: (chunk: string) => void
}

/** Failure with a fixed, sanitized, actionable message — never raw child errors or env data. */
export class GitCloneError extends Error {}

const REDACTED_PLACEHOLDER = '[REDACTED]'

/**
 * Operational variables copied into the authenticated child environment.
 *
 * Deliberately NOT `process.env`: ambient `GIT_*`, askpass variables, SSH
 * agent variables, and unrelated credentials are stripped. Proxy and CA bundle
 * settings are explicitly supported so corporate setups keep working without
 * inheriting credential-bearing configuration.
 */
const OPERATIONAL_ENV_KEYS = [
  // Executable lookup
  'PATH',
  'PATHEXT',
  // Platform runtime (Windows)
  'COMSPEC',
  'ProgramFiles',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'WINDIR',
  // Home and temp paths
  'APPDATA',
  'HOMEDRIVE',
  'HOMEPATH',
  'HOME',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
  // Locale
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  // Explicitly supported proxy settings
  'ALL_PROXY',
  'all_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'NO_PROXY',
  'no_proxy',
  // Explicitly supported CA bundle settings
  'CURL_CA_BUNDLE',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
] as const

/**
 * Build the secret-free credential helper command string.
 *
 * The credential request arrives on stdin. Composition of the helper differs
 * across git versions: recent git (>= 2.36) runs `sh -c "<helper> <operation>"`
 * (the operation token is appended to the script text), while older versions
 * pass the operation as an argument (`sh -c "<helper> \"$@\"" ...`). The
 * helper therefore ignores the operation completely — its stdout is only
 * consulted for `get`, and a trailing bare `:` absorbs whatever git appends:
 * - scans stdin for an exact `host=<expected>` line so the credentials are
 *   only ever offered for the selected HTTPS host (redirects to other hosts
 *   get nothing),
 * - prints username/password read from dedicated child-env variables using
 *   quoted shell expansion and builtin `printf`.
 *
 * No secret is interpolated into this string — only the host name.
 */
export function buildCredentialHelper(host: string): string {
  return [
    'h=',
    'while IFS= read -r l; do [ "$l" = "host=' + host + '" ] && h=1; done',
    'test -n "$h" || exit 0',
    'printf "username=%s\\n" "$BB_GIT_USERNAME"',
    'printf "password=%s\\n" "$BB_GIT_PASSWORD"',
    ':',
  ].join('; ')
}

/**
 * Build the authenticated child environment.
 *
 * A fresh allowlisted environment (never `process.env` spread), with git
 * configuration isolation, non-interactive mode, the secret-free credential
 * helper, and the dedicated child-env credential variables.
 */
export function buildAuthenticatedEnv(
  cloneUrl: string,
  credentials: GitCloneCredentials,
  devNullPath: string,
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of OPERATIONAL_ENV_KEYS) {
    const value = process.env[key]
    if (value !== undefined) {
      env[key] = value
    }
  }

  // Disable system/global git configuration for this process: inherited URL
  // rewrites, http.extraHeader, credential managers, and tracing config must
  // not override the clean request. The null-device path is portable.
  env.GIT_CONFIG_GLOBAL = devNullPath
  env.GIT_CONFIG_SYSTEM = devNullPath
  env.GIT_CONFIG_NOSYSTEM = '1'

  // A prompt would mean the profile credentials were absent or rejected —
  // fail instead of hanging or falling back to ambient credentials.
  env.GIT_TERMINAL_PROMPT = '0'

  // Child-scoped git configuration:
  //   0. an empty `credential.helper` resets helpers inherited from config
  //   1. our secret-free helper (reads credentials from child env vars only)
  env.GIT_CONFIG_COUNT = '2'
  env.GIT_CONFIG_KEY_0 = 'credential.helper'
  env.GIT_CONFIG_VALUE_0 = ''
  env.GIT_CONFIG_KEY_1 = 'credential.helper'
  env.GIT_CONFIG_VALUE_1 = buildCredentialHelper(credentials.host)

  // Dedicated child-env credential variables consumed only by the helper.
  // The clone URL only feeds the helper's host restriction.
  env.BB_GIT_USERNAME = credentials.username
  env.BB_GIT_PASSWORD = credentials.password
  env.BB_GIT_HOST = new URL(cloneUrl).host

  return env
}

/**
 * Every value that could leak a credential into child output: the raw token,
 * its URL-encoded form, and the Basic-auth payload.
 */
export function credentialSecrets(credentials: {password: string; username: string}): string[] {
  const basic = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
  return [credentials.password, encodeURIComponent(credentials.password), basic]
}

/**
 * Bounded streaming redactor.
 *
 * Forwards chunks through `write` with every known secret replaced, holding
 * back the last (longest secret - 1) characters so a secret split across two
 * chunks is still caught when the next chunk arrives. Output never
 * accumulates: full logs are not kept in memory.
 */
export function createRedactingStream(
  secrets: string[],
  write: (chunk: string) => void,
): {end: () => void; write: (chunk: string) => void} {
  const present = [...new Set(secrets.filter((secret) => secret.length > 0))].sort(
    (a, b) => b.length - a.length,
  )
  const keep = present.length > 0 ? present[0].length - 1 : 0
  let carry = ''

  const redact = (text: string): string => {
    let redacted = text
    for (const secret of present) {
      redacted = redacted.split(secret).join(REDACTED_PLACEHOLDER)
    }

    return redacted
  }

  return {
    write(chunk: string): void {
      const redacted = redact(carry + chunk)
      if (keep === 0) {
        write(redacted)
        carry = ''
        return
      }

      if (redacted.length > keep) {
        write(redacted.slice(0, redacted.length - keep))
        carry = redacted.slice(redacted.length - keep)
      } else {
        carry = redacted
      }
    },
    end(): void {
      if (carry.length > 0) {
        write(redact(carry))
        carry = ''
      }
    },
  }
}

/** Parse `git version X.Y.Z <distro suffix>` output; undefined when unparseable. */
export function parseGitVersion(
  output: string,
): {major: number; minor: number; patch: number} | undefined {
  const match = /^git version (\d+)\.(\d+)(?:\.(\d+))?/.exec(output.trim())
  if (!match) {
    return undefined
  }

  return {major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3] ?? 0)}
}

/** Compare a parsed version against the authenticated-clone minimum. */
export function isGitVersionAtLeast(
  version: {major: number; minor: number; patch: number},
  minimum: {major: number; minor: number; patch: number},
): boolean {
  if (version.major !== minimum.major) {
    return version.major > minimum.major
  }

  if (version.minor !== minimum.minor) {
    return version.minor > minimum.minor
  }

  return version.patch >= minimum.patch
}

interface GitSpawnResult {
  code: number | null
  signal: NodeJS.Signals | null
  spawnError?: NodeJS.ErrnoException
  stdout?: string
}

/**
 * Run `git` with `shell: false`, streaming stdout/stderr through a redactor.
 *
 * Success is resolved only on `close` (after output drains). Synchronous
 * spawn errors, emitted `error` events, non-zero statuses, and signal
 * terminations each settle the promise exactly once; nothing serializes the
 * spawn options or the raw error object.
 */
function runGit(
  argv: string[],
  options: {
    collectStdout?: boolean
    cwd?: string
    env?: Record<string, string>
    secrets?: string[]
    write?: (chunk: string) => void
  },
): Promise<GitSpawnResult> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn('git', argv, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error: unknown) {
      resolve({code: null, signal: null, spawnError: error as NodeJS.ErrnoException})
      return
    }

    const sink = options.write ?? ((chunk: string) => process.stderr.write(chunk))
    const redactor = createRedactingStream(options.secrets ?? [], sink)

    let stdoutText = ''
    let settled = false
    let spawnError: NodeJS.ErrnoException | undefined

    const settleWithClose = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) {
        return
      }

      settled = true
      resolve({
        code,
        signal,
        spawnError,
        stdout: options.collectStdout ? stdoutText : undefined,
      })
    }

    const settleWithError = (error: NodeJS.ErrnoException): void => {
      if (settled) {
        return
      }

      settled = true
      redactor.end()
      resolve({code: null, signal: null, spawnError: error})
    }

    if (child.stdout) {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        if (options.collectStdout) {
          stdoutText += chunk
        }

        redactor.write(chunk)
      })
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        redactor.write(chunk)
      })
    }

    child.on('error', (error: NodeJS.ErrnoException) => {
      spawnError = error
      settleWithError(error)
    })

    child.on('close', (code, signal) => {
      redactor.end()
      settleWithClose(code, signal)
    })
  })
}

/**
 * Clone a repository by shelling out to the local `git` binary.
 *
 * Authenticated HTTPS mode (`credentials` present) requires Git >= 2.31,
 * clones with the isolated child environment, and runs from a neutral
 * temporary working directory so no enclosing repository's local config is
 * discovered. Plain HTTPS and SSH mode uses ordinary Git behavior (ambient
 * environment and cwd preserved, no bb credential injection). Temporary
 * directories are removed in `finally`; a partially created destination is
 * left in place on failure.
 */
export async function cloneRepository(options: CloneRepositoryOptions): Promise<void> {
  const write = options.write ?? ((chunk: string) => process.stderr.write(chunk))
  const argv = ['clone', '--', options.url, path.resolve(options.destination)]

  if (options.credentials) {
    const versionResult = await runGit(['--version'], {collectStdout: true})
    if (versionResult.spawnError) {
      throw new GitCloneError(
        'Git executable not found. Install Git and make sure it is available on your PATH.',
      )
    }

    const version = parseGitVersion(versionResult.stdout ?? '')
    if (!version) {
      throw new GitCloneError('Unable to determine the installed Git version.')
    }

    if (!isGitVersionAtLeast(version, MINIMUM_GIT_VERSION)) {
      throw new GitCloneError(
        `Git ${MINIMUM_GIT_VERSION.major}.${MINIMUM_GIT_VERSION.minor} or newer is required for authenticated HTTPS cloning. Found Git ${version.major}.${version.minor}.${version.patch}.`,
      )
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), 'bb-clone-'))
    try {
      const env = buildAuthenticatedEnv(options.url, options.credentials, devNull)
      const result = await runGit(argv, {
        cwd: tempDir,
        env,
        secrets: credentialSecrets(options.credentials),
        write,
      })
      throwForCloneResult(result)
    } finally {
      await rm(tempDir, {force: true, recursive: true})
    }

    return
  }

  const result = await runGit(argv, {secrets: [], write})
  throwForCloneResult(result)
}

/**
 * Report fixed contextual failures, not raw child exception objects: git's
 * own (redacted) output has already been streamed to the sink.
 */
function throwForCloneResult(result: GitSpawnResult): void {
  if (result.spawnError) {
    if (result.spawnError.code === 'ENOENT') {
      throw new GitCloneError(
        'Git executable not found. Install Git and make sure it is available on your PATH.',
      )
    }

    throw new GitCloneError('Failed to start git clone.')
  }

  if (result.signal !== null && result.signal !== undefined) {
    throw new GitCloneError(`git clone was terminated by signal ${result.signal}.`)
  }

  if (result.code !== 0) {
    throw new GitCloneError(`git clone failed with exit code ${String(result.code)}.`)
  }
}
