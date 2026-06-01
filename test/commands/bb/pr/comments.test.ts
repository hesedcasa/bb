/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:comments', () => {
  let PrComments: any
  let createProfileManagerStub: SinonStub
  let listPullRequestCommentsStub: SinonStub
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
    listPullRequestCommentsStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/comments.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPullRequestComments: listPullRequestCommentsStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrComments = imported.default
  })

  it('calls listPullRequestComments with correct args and outputs JSON', async () => {
    const cmd = new PrComments(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestCommentsStub.calledOnce).to.be.true
    expect(listPullRequestCommentsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnceWith(mockResult)).to.be.true
  })

  it('passes pagination flags correctly', async () => {
    const cmd = new PrComments(['my-ws', 'my-repo', '42', '--page', '3', '--pagelen', '25'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(listPullRequestCommentsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 3, 25])
    expect(logJsonStub.calledOnceWith(mockResult)).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrComments(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(listPullRequestCommentsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrComments(['my-ws', 'my-repo', '42', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listPullRequestCommentsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 1, 10])
    expect(formatAsToonStub.calledOnceWith(mockResult)).to.be.true
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
