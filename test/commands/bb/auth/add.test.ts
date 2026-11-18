import {Command, Flags} from '@oclif/core'
import {expect} from 'chai'
import esmock from 'esmock'
import {stub} from 'sinon'

describe('auth:add', () => {
  // Auth:add command is a thin wrapper around @hesed/plugin-lib's createAuthAddCommand.
  // The detailed auth functionality (profile management, config file handling,
  // host defaulting, etc.) is tested in plugin-lib's own test suite. Here we
  // only test the Bitbucket-specific integration: the exact options handed to
  // the shared factory, including the opt-in Bitbucket Cloud default host.
  it('exports correct integration points', async () => {
    const {default: AuthAdd} = await import('../../../../src/commands/bb/auth/add.js')
    const {clearClients, testConnection} = await import('../../../../src/bitbucket/bitbucket-client.js')

    // Verify the command exists and is a function
    expect(AuthAdd).to.be.a('function')

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

    const createAuthAddCommand = stub().returns(Sentinel)
    const clearClients = stub()
    const testConnection = stub()

    const {default: AuthAdd} = await esmock('../../../../src/commands/bb/auth/add.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {clearClients, testConnection},
      '@hesed/plugin-lib': {createAuthAddCommand},
    })

    expect(createAuthAddCommand.calledOnce).to.be.true
    expect(createAuthAddCommand.firstCall.args[0]).to.deep.equal({
      clearClients,
      configFile: 'bb-config.json',
      defaultHost: 'https://bitbucket.org',
      serviceName: 'Bitbucket',
      testConnection,
    })

    // The wrapper exports the class the factory returned, unchanged.
    expect(AuthAdd).to.equal(Sentinel)
  })

  it('opts into an optional host flag without relaxing the other flags', async () => {
    const {default: AuthAdd} = await import('../../../../src/commands/bb/auth/add.js')

    // With defaultHost configured, plugin-lib builds the legacy host flag
    // optional; everything else keeps the shared factory's non-TTY requirement.
    expect(AuthAdd.flags.host.required).to.be.false
    expect(AuthAdd.flags.host.char).to.equal('u')
    expect(AuthAdd.flags.host.description).to.equal('Bitbucket instance URL')
    expect(AuthAdd.flags.apiToken.required).to.be.true
    expect(AuthAdd.flags.email.required).to.be.true
    expect(AuthAdd.flags.profile.required).to.be.true
  })
})
