/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {stub} from 'sinon'

const createMockConfig = () => ({
  configDir: '/tmp/test-config',
  root: process.cwd(),
  runHook: stub().resolves({failures: [], successes: []}),
})

describe('auth:profile', () => {
  let AuthProfile: any
  let mockGetDefaultProfile: any
  let mockSetDefaultProfile: any
  let logOutput: string[]

  beforeEach(async () => {
    logOutput = []

    mockGetDefaultProfile = async () => 'default'
    mockSetDefaultProfile = async () => {}

    AuthProfile = await esmock('../../../../src/commands/bb/auth/profile.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        setDefaultProfile: mockSetDefaultProfile,
      },
    })
  })

  it('shows current default profile when no flag given', async () => {
    const command = new AuthProfile.default([], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput).to.include('default')
  })

  it('sets default profile with --default flag', async () => {
    let setProfileCalled = false
    let setProfileName = ''

    mockSetDefaultProfile = async (_dir: string, profile: string, _log: any) => {
      setProfileCalled = true
      setProfileName = profile
    }

    AuthProfile = await esmock('../../../../src/commands/bb/auth/profile.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        setDefaultProfile: mockSetDefaultProfile,
      },
    })

    const command = new AuthProfile.default(['--default', 'work'], createMockConfig())

    command.log = () => {}

    await command.run()

    expect(setProfileCalled).to.be.true
    expect(setProfileName).to.equal('work')
  })

  it('does not call getDefaultProfile when setting default', async () => {
    let getCalled = false

    mockGetDefaultProfile = async () => {
      getCalled = true
      return 'default'
    }

    AuthProfile = await esmock('../../../../src/commands/bb/auth/profile.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        setDefaultProfile: mockSetDefaultProfile,
      },
    })

    const command = new AuthProfile.default(['--default', 'work'], createMockConfig())

    command.log = () => {}

    await command.run()

    expect(getCalled).to.be.false
  })
})
