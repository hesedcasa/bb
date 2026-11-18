/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {type SinonStub, stub} from 'sinon'

import {DEFAULT_HOST} from '../src/auth-host.js'

type Profile = {apiToken?: string; email?: string; host?: string}
type StoredConfig = {defaultProfile?: string; profiles: Record<string, Profile>}

const CREDENTIALS = {apiToken: 'test-token', email: '[EMAIL]'}

/**
 * Runs a command and returns its failure message.
 *
 * @param run The command invocation to await.
 * @returns The rejection message.
 */
async function rejectionMessage(run: Promise<unknown>): Promise<string> {
  try {
    await run
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  throw new Error('expected the command to fail')
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.stat(file)
    return true
  } catch {
    return false
  }
}

describe('auth-host: optional -u, --host', () => {
  let AuthAdd: any
  let AuthUpdate: any
  let clearClients: SinonStub
  let testConnection: SinonStub
  let configDir: string
  let configFile: string

  beforeEach(async () => {
    configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bb-auth-host-'))
    configFile = path.join(configDir, 'bb-config.json')
    clearClients = stub()
    testConnection = stub().resolves({success: true})

    // The real plugin-lib factories run here; only the Bitbucket client is
    // mocked, so the profile written to disk is the one the shared code
    // produces.
    const mocks = {'../src/bitbucket/bitbucket-client.js': {clearClients, testConnection}}
    AuthAdd = (await esmock('../src/commands/bb/auth/add.js', mocks)).default
    AuthUpdate = (await esmock('../src/commands/bb/auth/update.js', mocks)).default
  })

  afterEach(async () => {
    await fs.rm(configDir, {force: true, recursive: true})
  })

  function command(CommandClass: any, argv: string[]): any {
    const config = {
      bin: 'bb',
      configDir,
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    }

    return new CommandClass(argv, config)
  }

  async function seedConfig(config: StoredConfig): Promise<void> {
    await fs.writeFile(configFile, JSON.stringify(config, null, 2), {mode: 0o600})
  }

  async function readConfig(): Promise<StoredConfig> {
    return JSON.parse(await fs.readFile(configFile, 'utf8')) as StoredConfig
  }

  describe('add', () => {
    it('stores the Bitbucket Cloud default when -u is omitted', async () => {
      const result = await command(AuthAdd, ['-p', 'prod', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run()

      expect(result).to.deep.equal({success: true})

      const {profiles} = await readConfig()
      expect(profiles.prod).to.deep.equal({...CREDENTIALS, host: DEFAULT_HOST})
      // The persisted profile is the configuration the connection was tested
      // with — no second resolution path.
      expect(testConnection.firstCall.args[0]).to.deep.equal(profiles.prod)
      expect(clearClients.calledOnce).to.be.true
    })

    it('stores an explicit -u value verbatim', async () => {
      await command(AuthAdd, [
        '-p',
        'prod',
        '-e',
        CREDENTIALS.email,
        '-t',
        CREDENTIALS.apiToken,
        '-u',
        'https://bb.internal.example',
      ]).run()

      const {profiles} = await readConfig()
      expect(profiles.prod).to.deep.equal({...CREDENTIALS, host: 'https://bb.internal.example'})
      expect(testConnection.firstCall.args[0]).to.deep.equal(profiles.prod)
    })

    it('still requires --profile and writes nothing without it', async () => {
      const message = await rejectionMessage(
        command(AuthAdd, ['-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run(),
      )

      expect(message).to.include('Missing required flag profile')
      expect(await fileExists(configFile)).to.be.false
      expect(testConnection.called).to.be.false
    })

    it('refuses to overwrite an existing profile', async () => {
      const existing: StoredConfig = {profiles: {prod: {...CREDENTIALS, host: 'https://keep.example'}}}
      await seedConfig(existing)

      const message = await rejectionMessage(
        command(AuthAdd, ['-p', 'prod', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run(),
      )

      expect(message).to.include("Profile 'prod' already exists")
      expect(await readConfig()).to.deep.equal(existing)
      expect(testConnection.called).to.be.false
    })

    it('saves the profile before a failed connection test, as the factory does', async () => {
      testConnection.resolves({error: 'rejected by the server', success: false})

      const message = await rejectionMessage(
        command(AuthAdd, ['-p', 'prod', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run(),
      )

      expect(message).to.include('Authentication is invalid. Please check your credentials.')
      expect(message).to.include('rejected by the server')
      expect((await readConfig()).profiles.prod).to.deep.equal({...CREDENTIALS, host: DEFAULT_HOST})
      expect(clearClients.calledOnce).to.be.true
    })
  })

  describe('update', () => {
    it('preserves the stored host when -u is omitted', async () => {
      await seedConfig({
        defaultProfile: 'work',
        profiles: {
          other: {apiToken: 'other-token', email: 'other@example.com'},
          work: {...CREDENTIALS, apiToken: 'old-token', email: 'old@example.com', host: 'https://bb.internal.example'},
        },
      })

      await command(AuthUpdate, ['-p', 'work', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run()

      const written = await readConfig()
      expect(written.defaultProfile).to.equal('work')
      expect(written.profiles.other).to.deep.equal({apiToken: 'other-token', email: 'other@example.com'})
      expect(written.profiles.work).to.deep.equal({...CREDENTIALS, host: 'https://bb.internal.example'})
      expect(testConnection.firstCall.args[0]).to.deep.equal(written.profiles.work)
    })

    it('overwrites the stored host when -u is given', async () => {
      await seedConfig({profiles: {work: {...CREDENTIALS, host: 'https://bb.internal.example'}}})

      await command(AuthUpdate, [
        '-p',
        'work',
        '-e',
        CREDENTIALS.email,
        '-t',
        CREDENTIALS.apiToken,
        '-u',
        'https://bb.other.example',
      ]).run()

      expect((await readConfig()).profiles.work).to.deep.equal({...CREDENTIALS, host: 'https://bb.other.example'})
    })

    it('stores the default when the profile has no host', async () => {
      await seedConfig({profiles: {work: {...CREDENTIALS, host: undefined}}})

      await command(AuthUpdate, ['-p', 'work', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run()

      expect((await readConfig()).profiles.work).to.deep.equal({...CREDENTIALS, host: DEFAULT_HOST})
    })

    it('leaves the config untouched for an unknown profile', async () => {
      await seedConfig({profiles: {work: {...CREDENTIALS, host: 'https://bb.internal.example'}}})
      const before = await fs.readFile(configFile, 'utf8')

      const message = await rejectionMessage(
        command(AuthUpdate, ['-p', 'nope', '-e', CREDENTIALS.email, '-t', CREDENTIALS.apiToken]).run(),
      )

      expect(message).to.include("Profile 'nope' does not exist")
      expect(await fs.readFile(configFile, 'utf8')).to.equal(before)
      expect(testConnection.called).to.be.false
    })
  })
})
