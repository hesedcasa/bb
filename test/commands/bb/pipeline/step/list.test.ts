/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pipeline:step:list', () => {
  let PipelineStepList: any
  let createProfileManagerStub: SinonStub
  let listPipelineStepsStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {
    data: {
      page: 1,
      pagelen: 10,
      values: [
        {
          name: 'Build',
          state: {name: 'COMPLETED', result: {name: 'FAILED'}, type: 'pipeline_state_completed'},
          uuid: '{step-1}',
        },
        {
          name: 'Test',
          state: {name: 'COMPLETED', result: {name: 'PASSED'}, type: 'pipeline_state_completed'},
          uuid: '{step-2}',
        },
      ],
    },
    success: true,
  }

  const failureResult = {error: {error: {message: 'Pipeline not found'}}, success: false}
  const authFailureResult = {error: {error: {message: 'Invalid credentials'}}, success: false}

  function makeCommand(argv: string[]): any {
    return new PipelineStepList(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
  }

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listPipelineStepsStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../../src/commands/bb/pipeline/step/list.js', {
      '../../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPipelineSteps: listPipelineStepsStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PipelineStepList = imported.default
  })

  it('forwards the positional args in order and returns the full result', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}'])

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPipelineStepsStub.calledOnce).to.be.true
    expect(listPipelineStepsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', '{pipe-uuid}', 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
    expect(result.data.values[0].state.result.name).to.equal('FAILED')
  })

  it('forwards --page and --pagelen so later step pages are reachable', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '--page', '2', '--pagelen', '25'])

    await cmd.run()

    expect(listPipelineStepsStub.calledOnce).to.be.true
    expect(listPipelineStepsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', '{pipe-uuid}', 2, 25])
  })

  it('uses default JSON mode', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}'])

    expect(cmd.jsonEnabled()).to.be.true

    const result = await cmd.run()

    expect(cmd.jsonEnabled()).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes --profile through to the profile manager with bb-config.json', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '--profile', 'work'])

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
    expect(createProfileManagerStub.firstCall.args[2]).to.equal('bb-config.json')
  })

  it('passes the -p short flag through to the profile manager', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '-p', 'ci'])

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('ci')
  })

  it('logs TOON once on success with --toon and never calls logJson', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '--toon'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    expect(cmd.jsonEnabled()).to.be.false

    await cmd.run()

    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledOnceWith('toon-output')).to.be.true
    expect(logJsonStub.called).to.be.false
  })

  it('returns a failed result without explicit logging in default JSON mode', async () => {
    listPipelineStepsStub.resolves(failureResult)
    const cmd = makeCommand(['my-ws', 'my-repo', '{missing}'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    const result = await cmd.run()

    expect(result).to.deep.equal(failureResult)
    expect(logJsonStub.called).to.be.false
    expect(logStub.called).to.be.false
  })

  it('emits the structured JSON error once via logJson on failure with --toon', async () => {
    listPipelineStepsStub.resolves(authFailureResult)
    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}', '--toon'])
    const logStub = stub(cmd, 'log')
    const logJsonStub = stub(cmd, 'logJson')

    const result = await cmd.run()

    expect(formatAsToonStub.called).to.be.false
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(authFailureResult)
    expect(logStub.called).to.be.false
    expect(result).to.deep.equal(authFailureResult)
  })

  it('fails parsing when required args are missing', async () => {
    const cmd = makeCommand(['my-ws'])

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('required args')
    }

    expect(listPipelineStepsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('throws the missing-config error without calling the client or cleanup', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = makeCommand(['my-ws', 'my-repo', '{pipe-uuid}'])
    const logStub = stub(cmd, 'log')

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPipelineStepsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logStub.called).to.be.false
  })
})
