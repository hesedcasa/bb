import {expect} from 'chai'

describe('auth:profile', () => {
  // Auth:profile command is a thin wrapper around @hesed/plugin-lib's createAuthProfileCommand.
  // The detailed functionality is tested in plugin-lib's own test suite.
  it('exports the command', async () => {
    const {default: AuthProfile} = await import('../../../../src/commands/bb/auth/profile.js')

    // Verify the command exists and is a function
    expect(AuthProfile).to.be.a('function')
  })
})
