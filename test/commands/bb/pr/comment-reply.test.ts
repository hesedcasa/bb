/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:comment-reply', () => {
  let PrCommentReply: any
  let createProfileManagerStub: SinonStub
  let replyToPullRequestCommentStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {content: {raw: 'Thanks!'}, id: 200}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    replyToPullRequestCommentStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/comment-reply.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        replyToPullRequestComment: replyToPullRequestCommentStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrCommentReply = imported.default
  })

  it('calls replyToPullRequestComment with correct args and outputs JSON', async () => {
    const cmd = new PrCommentReply(['my-ws', 'my-repo', '42', '100', '--body', 'Thanks!'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(replyToPullRequestCommentStub.calledOnce).to.be.true
    expect(replyToPullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      100,
      'Thanks!',
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnceWith(mockResult)).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrCommentReply(['my-ws', 'my-repo', '42', '100', '--body', 'hi'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(replyToPullRequestCommentStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrCommentReply(['my-ws', 'my-repo', '42', '100', '--body', 'Thanks!', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(replyToPullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      100,
      'Thanks!',
    ])
    expect(formatAsToonStub.calledOnceWith(mockResult)).to.be.true
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
