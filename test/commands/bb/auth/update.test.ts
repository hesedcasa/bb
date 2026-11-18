import {Command, Flags} from '@oclif/core'
import {expect} from 'chai'
import esmock from 'esmock'
import {stub} from 'sinon'

describe('auth:update', () => {
  // Auth:update command is a thin wrapper around @hesed/plugin-lib's createAuthUpdateCommand.
  // The detailed auth functionality (profile management, config file handling,
  // host preservation/defaulting, etc.) is tested in plugin-lib's own test
  // suite. Here we only test the Bitbucket-specific integration: the exact
  // options handed to the shared factory, including the opt-in Bitbucket
  // Cloud default host.
  it('exports correct integration points', async () => {
    const {default: AuthUpdate} = await import('../../../../src/commands/bb/auth/update.js')
    const {clearClients, testConnection} = await import('../../../../src/bitbucket/bitbucket-client.js')

    // Verify the command exists and is a function
    expect(AuthUpdate).to.be.a('function')

    // Verify the integration points exist
    expect(clearClients).to.be.a('function')
    expect(testConnection).to.be.a('function')
  })

  it('builds the command from the shared factory with the Bitbucket options', async () => {
    class Sentinel extends Command {
      static flags = {
        host: Flags.string({char: 'u', description: 'Sentinel host'}),
        profile: Flags.string({char: 'p', description: 'Profile name'}),
      }

      public async run(): Promise<void> {}
    }

    const createAuthUpdateCommand = stub().returns(Sentinel)
    const clearClients = stub()
    const testConnection = stub()

    const {default: AuthUpdate} = await esmock('../../../../src/commands/bb/auth/update.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {clearClients, testConnection},
      '@hesed/plugin-lib': {createAuthUpdateCommand},
    })

    expect(createAuthUpdateCommand.calledOnce).to.be.true
    expect(createAuthUpdateCommand.firstCall.args[0]).to.deep.equal({
      clearClients,
      configFile: 'bb-config.json',
      defaultHost: 'https://bitbucket.org',
      serviceName: 'Bitbucket',
      testConnection,
    })

    // The wrapper exports the class the factory returned, unchanged.
    expect(AuthUpdate).to.equal(Sentinel)
  })

  it('opts into an optional host flag without relaxing the other flags', async () => {
    const {default: AuthUpdate} = await import('../../../../src/commands/bb/auth/update.js')

    // With defaultHost configured, plugin-lib builds the legacy host flag
    // optional; everything else keeps the shared factory's non-TTY requirement.
    expect(AuthUpdate.flags.host.required).to.be.false
    expect(AuthUpdate.flags.host.char).to.equal('u')
    expect(AuthUpdate.flags.host.description).to.equal('Bitbucket instance URL')
    expect(AuthUpdate.flags.apiToken.required).to.be.true
    expect(AuthUpdate.flags.email.required).to.be.true
    expect(AuthUpdate.flags.profile.required).to.be.true
  })
})
