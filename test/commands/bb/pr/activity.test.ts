/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:activity', () => {
  let PrActivity: any
  let createProfileManagerStub: SinonStub
  let listPullRequestActivityStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {values: [{update: {source: {commit: {hash: 'aaa111'}}}}]}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listPullRequestActivityStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/activity.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPullRequestActivity: listPullRequestActivityStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrActivity = imported.default
  })

  it('calls listPullRequestActivity with correct args and outputs JSON', async () => {
    const cmd = new PrActivity(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestActivityStub.calledOnce).to.be.true
    expect(listPullRequestActivityStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes optional flags correctly', async () => {
    const cmd = new PrActivity(['my-ws', 'my-repo', '42', '--page', '2', '--pagelen', '50'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    await cmd.run()

    expect(listPullRequestActivityStub.calledOnce).to.be.true
    expect(listPullRequestActivityStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 2, 50])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrActivity(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestActivityStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrActivity(['my-ws', 'my-repo', '42', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listPullRequestActivityStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
