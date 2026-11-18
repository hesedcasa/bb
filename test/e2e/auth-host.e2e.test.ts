import {expect} from 'chai'
import {execFile} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {promisify} from 'node:util'

import {deleteRepo, RUN_PREFIX, seedRepo} from './fixtures.js'
import {createConfigDir, removeConfigDir, requireEnv, runCliJson, runCliOk} from './helpers.js'

const execFileAsync = promisify(execFile)

type Profile = {apiToken?: string; email?: string; host?: string}
type StoredConfig = {defaultProfile?: string; profiles: Record<string, Profile>}

/** Bitbucket Cloud, the host an omitted `-u, --host` must store. */
const CLOUD_HOST = 'https://bitbucket.org'
/** A non-Cloud value, to prove an explicit host is stored verbatim. */
const CUSTOM_HOST = 'https://bb.internal.example'

/**
 * Reads the CLI's config file.
 *
 * @param configDir The dir holding bb-config.json.
 * @returns The parsed config file.
 */
async function readConfig(configDir: string): Promise<StoredConfig> {
  return JSON.parse(await fs.readFile(path.join(configDir, 'bb-config.json'), 'utf8')) as StoredConfig
}

describe('e2e: auth host', () => {
  let configDir: string
  const scratchDirs: string[] = []
  const cloneDirs: string[] = []
  let fixtureSlug: string | undefined

  before(async () => {
    configDir = await createConfigDir()
  })

  after(async () => {
    await removeConfigDir(configDir)

    await Promise.all([...scratchDirs, ...cloneDirs].map((dir) => fs.rm(dir, {force: true, recursive: true})))

    if (fixtureSlug) await deleteRepo(fixtureSlug)
  })

  /**
   * Writes a throwaway config dir holding a single host-less profile.
   *
   * The shared fixture keeps its own host-less profiles; this one exists so an
   * `auth update` against a host-less profile cannot disturb it.
   *
   * @param profile The profile name to write.
   * @returns The config dir, removed by the suite's teardown.
   */
  async function createHostlessConfigDir(profile: string): Promise<string> {
    const {apiToken, email} = requireEnv()
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bb-e2e-auth-host-'))
    scratchDirs.push(dir)
    await fs.writeFile(
      path.join(dir, 'bb-config.json'),
      JSON.stringify({defaultProfile: profile, profiles: {[profile]: {apiToken, email}}}, null, 2),
      {mode: 0o600},
    )

    return dir
  }

  it('stores the Bitbucket Cloud host when -u is omitted', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'omitted-host'

    await runCliOk(['bb', 'auth', 'add', '-p', profile, '-e', email, '-t', apiToken], configDir)

    const stored = (await readConfig(configDir)).profiles[profile]
    expect(stored.host).to.equal(CLOUD_HOST)
    expect(stored.email).to.equal(email)
    // Never assert the token's value: a failing assertion would print it.
    expect(stored.apiToken).to.be.a('string').and.not.empty
  })

  it('authenticates and reads with a profile that was added without -u', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'omitted-host-read'

    await runCliOk(['bb', 'auth', 'add', '-p', profile, '-e', email, '-t', apiToken], configDir)
    const test = await runCliJson<{success: boolean}>(['bb', 'auth', 'test', '-p', profile, '--json'], configDir)
    expect(test.success).to.be.true

    const listed = await runCliJson<{data: {values: Array<{workspace: {slug: string}}>}; success: boolean}>(
      ['bb', 'workspace', 'list', '-p', profile],
      configDir,
    )
    expect(listed.success).to.be.true
    expect(listed.data.values.map((membership) => membership.workspace.slug)).to.include(process.env.E2E_WORKSPACE)
  })

  it('stores an explicit host verbatim, preserves it on update, then overwrites it', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'explicit-host'

    await runCliOk(['bb', 'auth', 'add', '-p', profile, '-e', email, '-t', apiToken, '-u', CUSTOM_HOST], configDir)
    expect((await readConfig(configDir)).profiles[profile].host).to.equal(CUSTOM_HOST)

    // Omission on update keeps what is stored — it does not reset it to the default.
    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken], configDir)
    const preserved = (await readConfig(configDir)).profiles[profile]
    expect(preserved.host).to.equal(CUSTOM_HOST)
    expect(preserved.email).to.equal(email)

    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken, '-u', CLOUD_HOST], configDir)
    expect((await readConfig(configDir)).profiles[profile].host).to.equal(CLOUD_HOST)
  })

  it('stores the fallback host when updating a host-less profile without -u', async () => {
    const {apiToken, email} = requireEnv()
    const profile = 'hostless-profile'
    const hostlessDir = await createHostlessConfigDir(profile)
    expect((await readConfig(hostlessDir)).profiles[profile].host).to.be.undefined

    await runCliOk(['bb', 'auth', 'update', '-p', profile, '-e', email, '-t', apiToken], hostlessDir)

    const stored = (await readConfig(hostlessDir)).profiles[profile]
    expect(stored.host).to.equal(CLOUD_HOST)
    expect(stored.email).to.equal(email)
  })

  it('keeps reading with an untouched host-less profile', async () => {
    // The shared fixture's `default` profile has no stored host and is never
    // written by this suite: it must keep working without a migration.
    const {workspace} = requireEnv()
    expect((await readConfig(configDir)).profiles.default.host).to.be.undefined

    const test = await runCliJson<{success: boolean}>(['bb', 'auth', 'test', '--json'], configDir)
    expect(test.success).to.be.true

    const listed = await runCliJson<{data: {values: Array<{workspace: {slug: string}}>}; success: boolean}>(
      ['bb', 'workspace', 'list'],
      configDir,
    )
    expect(listed.success).to.be.true
    expect(listed.data.values.map((membership) => membership.workspace.slug)).to.include(workspace)
  })

  // The stored host must not leak into git routing: an https clone always uses
  // the API-declared Cloud URL and the Cloud credential host, whatever the
  // profile holds. One clone per profile shape, against a private fixture repo.
  it('clones over https with host-less, Cloud-default and custom-host profiles', async () => {
    const {apiToken, email, workspace} = requireEnv()
    const seeded = await seedRepo('auth-host-clone')
    fixtureSlug = seeded.slug

    const hostlessDir = await createHostlessConfigDir('clone-hostless')
    await runCliOk(['bb', 'auth', 'add', '-p', 'clone-cloud', '-e', email, '-t', apiToken], configDir)
    await runCliOk(
      ['bb', 'auth', 'add', '-p', 'clone-custom', '-e', email, '-t', apiToken, '-u', CUSTOM_HOST],
      configDir,
    )

    const shapes: Array<{configDir: string; label: string; profile: string}> = [
      {configDir: hostlessDir, label: 'host-less', profile: 'clone-hostless'},
      {configDir, label: 'Cloud default', profile: 'clone-cloud'},
      {configDir, label: 'custom host', profile: 'clone-custom'},
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
      const {stdout} = await execFileAsync('git', ['-C', destination, 'rev-parse', '--is-inside-work-tree'])
      expect(stdout.trim(), `${label} profile did not produce a worktree`).to.equal('true')
    }
  })
})
