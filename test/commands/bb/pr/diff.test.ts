/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:diff', () => {
  let PrDiff: any
  let readConfigStub: SinonStub
  let getPullRequestDiffStub: SinonStub
  let clearClientsStub: SinonStub

  const mockConfig = {
    auth: {
      apiToken: 'test-token',
      email: 'test@example.com',
      host: 'https://bitbucket.org',
    },
  }

  const mockDiff = 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n'
  const mockResult = {data: mockDiff, success: true}

  beforeEach(async () => {
    readConfigStub = stub().resolves(mockConfig)
    getPullRequestDiffStub = stub().resolves(mockResult)
    clearClientsStub = stub()

    const imported = await esmock('../../../../src/commands/bb/pr/diff.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getPullRequestDiff: getPullRequestDiffStub,
      },
      '../../../../src/config.js': {readConfig: readConfigStub},
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

    expect(readConfigStub.calledOnce).to.be.true
    expect(getPullRequestDiffStub.calledOnce).to.be.true
    expect(getPullRequestDiffStub.firstCall.args).to.deep.equal([mockConfig.auth, 'my-ws', 'my-repo', 123])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logStub.calledOnceWith(mockDiff)).to.be.true
  })

  it('returns early when config is missing', async () => {
    readConfigStub.resolves(null)

    const cmd = new PrDiff(['my-ws', 'my-repo', '123'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
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
