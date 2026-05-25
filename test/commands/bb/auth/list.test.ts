/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

const createMockConfig = () => ({
  bin: 'bb',
  configDir: '/tmp/test-config',
  root: process.cwd(),
  runHook: stub().resolves({failures: [], successes: []}),
})

describe('auth:list', () => {
  let AuthList: any
  let fsStub: Record<string, SinonStub>
  let logOutput: string[]

  beforeEach(async () => {
    logOutput = []

    fsStub = {
      readJSON: stub().resolves({
        profiles: {
          default: {
            apiToken: 'default-token-value',
            email: 'default@example.com',
            host: 'https://bitbucket.org',
          },
          work: {
            apiToken: 'work-token-value',
            host: 'https://bitbucket.org',
          },
        },
      }),
    }

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      'fs-extra': {default: fsStub},
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
    fsStub.readJSON.rejects(Object.assign(new Error('ENOENT: no such file or directory'), {code: 'ENOENT'}))

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      'fs-extra': {default: fsStub},
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
    fsStub.readJSON.resolves({})

    AuthList = await esmock('../../../../src/commands/bb/auth/list.js', {
      'fs-extra': {default: fsStub},
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
