import {expect} from 'chai'

describe('auth:update', () => {
  // Auth:update command is a thin wrapper around @hesed/plugin-lib's createAuthUpdateCommand.
  // The detailed auth functionality is tested in plugin-lib's own test suite.
  // Here we only test the Bitbucket-specific integration points.
  it('exports correct integration points', async () => {
    const {default: AuthUpdate} = await import('../../../../src/commands/bb/auth/update.js')
    const {clearClients, testConnection} = await import('../../../../src/bitbucket/bitbucket-client.js')

    // Verify the command exists and is a function
    expect(AuthUpdate).to.be.a('function')

    // Verify the integration points exist
    expect(clearClients).to.be.a('function')
    expect(testConnection).to.be.a('function')
  })
})
