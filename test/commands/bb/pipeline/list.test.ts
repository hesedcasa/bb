/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pipeline:list', () => {
  let PipelineList: any
  let createProfileManagerStub: SinonStub
  let listPipelinesStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {
    data: {values: [{uuid: '{pipe-1}'}, {uuid: '{pipe-2}'}]},
    success: true,
  }

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listPipelinesStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pipeline/list.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPipelines: listPipelinesStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PipelineList = imported.default
  })

  it('calls listPipelines with correct args and outputs JSON', async () => {
    const cmd = new PipelineList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPipelinesStub.calledOnce).to.be.true
    expect(listPipelinesStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 1, 10, undefined])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(mockResult)
  })

  it('passes custom page, pagelen, and sort flags', async () => {
    const cmd = new PipelineList(['my-ws', 'my-repo', '--page', '3', '--pagelen', '25', '--sort', 'created_on'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(listPipelinesStub.calledOnce).to.be.true
    expect(listPipelinesStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 3, 25, 'created_on'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PipelineList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPipelinesStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PipelineList(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listPipelinesStub.calledOnce).to.be.true
    expect(listPipelinesStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 1, 10, undefined])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
