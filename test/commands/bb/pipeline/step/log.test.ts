/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pipeline:step:log', () => {
  let PipelineStepLog: any
  let createProfileManagerStub: SinonStub
  let getPipelineStepLogStub: SinonStub
  let clearClientsStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockLog = '+ make build\n\n  step 1: ok\n   indented   \nlast line\n'
  const mockResult = {data: mockLog, success: true}
  const notFoundResult = {error: {error: {message: 'Step not found'}}, success: false}
  const authFailureResult = {error: {error: {message: 'Invalid credentials'}}, success: false}

  function makeCommand(argv: string[]): any {
    return new PipelineStepLog(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
  }

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getPipelineStepLogStub = stub().resolves(mockResult)
    clearClientsStub = stub()

    const imported = await esmock('../../../../../src/commands/bb/pipeline/step/log.js', {
      '../../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getPipelineStepLog: getPipelineStepLogStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub},
    })
    PipelineStepLog = imported.default
  })

  it('forwards all four positional args unchanged, including brace-wrapped UUIDs', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}'])
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getPipelineStepLogStub.calledOnce).to.be.true
    expect(getPipelineStepLogStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      '{pipe-uuid}',
      '{step-uuid}',
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logStub.calledOnceWith(mockLog)).to.be.true
    expect(result).to.be.undefined
  })

  it('always runs in plain-text mode', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}'])

    expect(cmd.jsonEnabled()).to.be.false

    await cmd.run()

    expect(cmd.jsonEnabled()).to.be.false
  })

  it('passes the selected profile through to the profile manager with bb-config.json', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}', '--profile', 'work'])
    stub(cmd, 'log')

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
    expect(createProfileManagerStub.firstCall.args[2]).to.equal('bb-config.json')
  })

  it('passes the -p short flag through to the profile manager', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}', '-p', 'ci'])
    stub(cmd, 'log')

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('ci')
  })

  it('passes an empty log through unchanged', async () => {
    getPipelineStepLogStub.resolves({data: '', success: true})
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}'])
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(logStub.calledOnceWith('')).to.be.true
  })

  it('clears clients and logs the JSON error once on a 404 result without raw output', async () => {
    getPipelineStepLogStub.resolves(notFoundResult)
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{missing}'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnceWith(notFoundResult)).to.be.true
    expect(logStub.called).to.be.false
  })

  it('clears clients and logs the JSON error once on an auth failure', async () => {
    getPipelineStepLogStub.resolves(authFailureResult)
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnceWith(authFailureResult)).to.be.true
    expect(logStub.called).to.be.false
  })

  it('fails parsing when required args are missing', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}'])

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('stepUuid')
      expect(error.message).to.include('required arg')
    }

    expect(getPipelineStepLogStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('fails parsing when the unsupported --toon flag is given', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}', '--toon'])

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('--toon')
    }

    expect(getPipelineStepLogStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('throws the missing-config error without calling the client or cleanup', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '{step-uuid}'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getPipelineStepLogStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })
})
