/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:diff', () => {
  let PrDiff: any
  let createProfileManagerStub: SinonStub
  let getPullRequestDiffStub: SinonStub
  let clearClientsStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockDiff = 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n'
  const mockResult = {data: mockDiff, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getPullRequestDiffStub = stub().resolves(mockResult)
    clearClientsStub = stub()

    const imported = await esmock('../../../../src/commands/bb/pr/diff.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getPullRequestDiff: getPullRequestDiffStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub},
    })
    PrDiff = imported.default
  })

  it('calls getPullRequestDiff with correct args and logs diff text', async () => {
    const cmd = new PrDiff(['my-ws', 'my-repo', '123'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getPullRequestDiffStub.calledOnce).to.be.true
    expect(getPullRequestDiffStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 123])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logStub.calledOnceWith(mockDiff)).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrDiff(['my-ws', 'my-repo', '123'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getPullRequestDiffStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logStub.called).to.be.false
  })

  it('outputs JSON on failure', async () => {
    const failResult = {error: 'Not found', success: false}
    getPullRequestDiffStub.resolves(failResult)

    const cmd = new PrDiff(['my-ws', 'my-repo', '123'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(logJsonStub.calledOnceWith(failResult)).to.be.true
  })
})
