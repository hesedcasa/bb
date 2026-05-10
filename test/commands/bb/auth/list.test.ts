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

describe('auth:list', () => {
  let AuthList: any
  let mockReadProfiles: any
  let mockGetDefaultProfile: any
  let logOutput: string[]

  beforeEach(async () => {
    logOutput = []

    mockReadProfiles = async () => ({
      default: {
        apiToken: 'default-token-value',
        email: 'default@example.com',
        host: 'https://bitbucket.org',
      },
      work: {
        apiToken: 'work-token-value',
        host: 'https://bitbucket.org',
      },
    })

    mockGetDefaultProfile = async () => 'default'

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        readProfiles: mockReadProfiles,
      },
    })
  })

  it('lists all profiles with default marker', async () => {
    const command = new AuthList.default([], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    const result = await command.run()

    expect(result.profiles).to.have.length(2)
    const defaultProfile = result.profiles.find((p: any) => p.name === 'default')
    const workProfile = result.profiles.find((p: any) => p.name === 'work')

    expect(defaultProfile.default).to.be.true
    expect(workProfile.default).to.be.undefined
    expect(logOutput[0]).to.include('default (default):')
    expect(logOutput[0]).to.include('default@example.com')
  })

  it('masks api tokens', async () => {
    const command = new AuthList.default([], createMockConfig())

    command.log = () => {}

    const result = await command.run()

    expect(result.profiles[0].apiToken).to.equal('def...alue')
  })

  it('shows message when no profiles exist', async () => {
    mockReadProfiles = async () => null

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        readProfiles: mockReadProfiles,
      },
    })

    const command = new AuthList.default([], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    const result = await command.run()

    expect(result.profiles).to.have.length(0)
    expect(logOutput[0]).to.include('No authentication profiles found')
  })

  it('returns empty profiles when readProfiles returns empty object', async () => {
    mockReadProfiles = async () => ({})

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      '../../../../src/config.js': {
        getDefaultProfile: mockGetDefaultProfile,
        readProfiles: mockReadProfiles,
      },
    })

    const command = new AuthList.default([], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    const result = await command.run()

    expect(result.profiles).to.have.length(0)
    expect(logOutput[0]).to.include('No authentication profiles found')
  })
})
