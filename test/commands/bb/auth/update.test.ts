import {Command, Flags} from '@oclif/core'
import {expect} from 'chai'
import esmock from 'esmock'
import {stub} from 'sinon'

describe('auth:update', () => {
  // Auth:update command is a thin wrapper around @hesed/plugin-lib's createAuthUpdateCommand.
  // The detailed auth functionality is tested in plugin-lib's own test suite.
  // Here we only test the Bitbucket-specific integration points and the
  // optional-host contract src/auth-host.ts adds.
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
        host: Flags.string({char: 'u', description: 'Sentinel host', required: true}),
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
      serviceName: 'Bitbucket',
      testConnection,
    })

    // The wrapper subclasses the factory's command, so its behaviour is the
    // factory's; only the host flag's requiredness is overridden.
    expect(Object.getPrototypeOf(AuthUpdate)).to.equal(Sentinel)
    expect(AuthUpdate.flags.host.required).to.be.false
    expect(AuthUpdate.flags.host.char).to.equal('u')
    expect(AuthUpdate.flags.host.description).to.equal('Sentinel host')
    expect(AuthUpdate.flags.profile).to.equal(Sentinel.flags.profile)
  })

  it('makes --host optional without relaxing the other flags', async () => {
    const {default: AuthUpdate} = await import('../../../../src/commands/bb/auth/update.js')

    expect(AuthUpdate.flags.host.required).to.be.false
    expect(AuthUpdate.flags.host.char).to.equal('u')
    expect(AuthUpdate.flags.host.description).to.equal('Bitbucket instance URL')
    // Everything else keeps the shared factory's non-TTY requirement.
    expect(AuthUpdate.flags.apiToken.required).to.be.true
    expect(AuthUpdate.flags.email.required).to.be.true
    expect(AuthUpdate.flags.profile.required).to.be.true
  })
})
