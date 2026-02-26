/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pipeline:trigger', () => {
  let PipelineTrigger: any
  let readConfigStub: SinonStub
  let triggerPipelineStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockConfig = {
    auth: {
      apiToken: 'test-token',
      email: 'test@example.com',
      host: 'https://bitbucket.org',
    },
  }

  const mockResult = {data: {state: {name: 'PENDING'}, uuid: '{triggered-pipe}'}, success: true}

  beforeEach(async () => {
    readConfigStub = stub().resolves(mockConfig)
    triggerPipelineStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pipeline/trigger.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        triggerPipeline: triggerPipelineStub,
      },
      '../../../../src/config.js': {readConfig: readConfigStub},
      '../../../../src/format.js': {formatAsToon: formatAsToonStub},
    })
    PipelineTrigger = imported.default
  })

  it('calls triggerPipeline with correct args and outputs JSON', async () => {
    const cmd = new PipelineTrigger(['my-ws', 'my-repo', '--branch', 'main'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(triggerPipelineStub.calledOnce).to.be.true
    expect(triggerPipelineStub.firstCall.args).to.deep.equal([
      mockConfig.auth,
      'my-ws',
      'my-repo',
      {refName: 'main', refType: 'branch'},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(mockResult)
  })

  it('includes custom selector when --custom flag is provided', async () => {
    const cmd = new PipelineTrigger(['my-ws', 'my-repo', '--branch', 'main', '--custom', 'my-pipeline'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(triggerPipelineStub.calledOnce).to.be.true
    expect(triggerPipelineStub.firstCall.args).to.deep.equal([
      mockConfig.auth,
      'my-ws',
      'my-repo',
      {refName: 'main', refType: 'branch', selector: {pattern: 'my-pipeline', type: 'custom'}},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    readConfigStub.resolves(null)

    const cmd = new PipelineTrigger(['my-ws', 'my-repo', '--branch', 'main'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(triggerPipelineStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PipelineTrigger(['my-ws', 'my-repo', '--branch', 'main', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(triggerPipelineStub.calledOnce).to.be.true
    expect(triggerPipelineStub.firstCall.args).to.deep.equal([
      mockConfig.auth,
      'my-ws',
      'my-repo',
      {refName: 'main', refType: 'branch'},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
