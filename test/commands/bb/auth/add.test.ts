import {expect} from 'chai'

describe('auth:add', () => {
  // Auth:add command is a thin wrapper around @hesed/plugin-lib's createAuthAddCommand.
  // The detailed auth functionality (profile management, config file handling, etc.) is
  // tested in plugin-lib's own test suite. Here we only test the Bitbucket-specific integration.
  it('exports correct integration points', async () => {
    const {default: AuthAdd} = await import('../../../../src/commands/bb/auth/add.js')
    const {clearClients, testConnection} = await import('../../../../src/bitbucket/bitbucket-client.js')

    // Verify the command exists and is a function
    expect(AuthAdd).to.be.a('function')

    // Verify the integration points exist
    expect(clearClients).to.be.a('function')
    expect(testConnection).to.be.a('function')
  })
})
