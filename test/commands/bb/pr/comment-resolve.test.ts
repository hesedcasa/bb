/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:comment-resolve', () => {
  let PrCommentResolve: any
  let createProfileManagerStub: SinonStub
  let resolvePullRequestCommentStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {id: 100, resolved: true}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    resolvePullRequestCommentStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/comment-resolve.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        resolvePullRequestComment: resolvePullRequestCommentStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrCommentResolve = imported.default
  })

  it('calls resolvePullRequestComment with correct args and outputs JSON', async () => {
    const cmd = new PrCommentResolve(['my-ws', 'my-repo', '42', '100'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(resolvePullRequestCommentStub.calledOnce).to.be.true
    expect(resolvePullRequestCommentStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 100])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnceWith(mockResult)).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrCommentResolve(['my-ws', 'my-repo', '42', '100'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(resolvePullRequestCommentStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrCommentResolve(['my-ws', 'my-repo', '42', '100', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(resolvePullRequestCommentStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 100])
    expect(formatAsToonStub.calledOnceWith(mockResult)).to.be.true
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
