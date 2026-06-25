/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:list', () => {
  let PrList: any
  let createProfileManagerStub: SinonStub
  let listPullRequestsStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {values: [{id: 1}, {id: 2}]}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listPullRequestsStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/list.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPullRequests: listPullRequestsStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrList = imported.default
  })

  it('calls listPullRequests with correct args and outputs JSON', async () => {
    const cmd = new PrList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestsStub.calledOnce).to.be.true
    expect(listPullRequestsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', undefined, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes optional flags correctly', async () => {
    const cmd = new PrList(['my-ws', 'my-repo', '--state', 'OPEN', '--page', '2', '--pagelen', '25'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    await cmd.run()

    expect(listPullRequestsStub.calledOnce).to.be.true
    expect(listPullRequestsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 'OPEN', 2, 25])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrList(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listPullRequestsStub.calledOnce).to.be.true
    expect(listPullRequestsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', undefined, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
