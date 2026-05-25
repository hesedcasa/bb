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

describe('auth:profile', () => {
  let AuthProfile: any
  let fsStub: Record<string, SinonStub>
  let logOutput: string[]

  beforeEach(async () => {
    logOutput = []

    fsStub = {
      outputJSON: stub().resolves(),
      readJSON: stub().resolves({
        defaultProfile: 'default',
        profiles: {
          default: {apiToken: 'default-token', host: 'https://bitbucket.org'},
          work: {apiToken: 'work-token', host: 'https://bitbucket.org'},
        },
      }),
    }

    AuthProfile = await esmock('../../../../src/commands/bb/auth/profile.js', {
      'fs-extra': {default: fsStub},
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
    const command = new AuthProfile.default(['--default', 'work'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(fsStub.outputJSON.calledOnce).to.be.true
    const writtenData = fsStub.outputJSON.firstCall.args[1]
    expect(writtenData.defaultProfile).to.equal('work')
    expect(logOutput).to.include("Default profile set to 'work'")
  })

  it('does not call outputJSON when showing default profile', async () => {
    const command = new AuthProfile.default([], createMockConfig())

    command.log = () => {}

    await command.run()

    expect(fsStub.outputJSON.called).to.be.false
  })
})
