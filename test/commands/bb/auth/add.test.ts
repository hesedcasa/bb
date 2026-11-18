import {Command, Flags} from '@oclif/core'
import {expect} from 'chai'
import esmock from 'esmock'
import {stub} from 'sinon'

describe('auth:add', () => {
  // Auth:add command is a thin wrapper around @hesed/plugin-lib's createAuthAddCommand.
  // The detailed auth functionality (profile management, config file handling, etc.) is
  // tested in plugin-lib's own test suite. Here we only test the Bitbucket-specific
  // integration and the optional-host contract src/auth-host.ts adds.
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
        host: Flags.string({char: 'u', description: 'Sentinel host', required: true}),
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
      serviceName: 'Bitbucket',
      testConnection,
    })

    // The wrapper subclasses the factory's command, so its behaviour is the
    // factory's; only the host flag's requiredness is overridden.
    expect(Object.getPrototypeOf(AuthAdd)).to.equal(Sentinel)
    expect(AuthAdd.flags.host.required).to.be.false
    expect(AuthAdd.flags.host.char).to.equal('u')
    expect(AuthAdd.flags.host.description).to.equal('Sentinel host')
    expect(AuthAdd.flags.profile).to.equal(Sentinel.flags.profile)
  })

  it('makes --host optional without relaxing the other flags', async () => {
    const {default: AuthAdd} = await import('../../../../src/commands/bb/auth/add.js')

    expect(AuthAdd.flags.host.required).to.be.false
    expect(AuthAdd.flags.host.char).to.equal('u')
    expect(AuthAdd.flags.host.description).to.equal('Bitbucket instance URL')
    // Everything else keeps the shared factory's non-TTY requirement.
    expect(AuthAdd.flags.apiToken.required).to.be.true
    expect(AuthAdd.flags.email.required).to.be.true
    expect(AuthAdd.flags.profile.required).to.be.true
  })
})
