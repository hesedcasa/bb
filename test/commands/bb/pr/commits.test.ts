/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('pr:commits', () => {
  let PrCommits: any
  let createProfileManagerStub: SinonStub
  let listPullRequestCommitsStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {values: [{hash: 'aaa111'}]}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listPullRequestCommitsStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/commits.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listPullRequestCommits: listPullRequestCommitsStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrCommits = imported.default
  })

  it('calls listPullRequestCommits with correct args and outputs JSON', async () => {
    const cmd = new PrCommits(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestCommitsStub.calledOnce).to.be.true
    expect(listPullRequestCommitsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 10, undefined])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes pagelen and the opaque page token correctly', async () => {
    const cmd = new PrCommits(['my-ws', 'my-repo', '42', '--page', '67Fg', '--pagelen', '50'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    await cmd.run()

    expect(listPullRequestCommitsStub.calledOnce).to.be.true
    expect(listPullRequestCommitsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 42, 50, '67Fg'])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrCommits(['my-ws', 'my-repo', '42'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listPullRequestCommitsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrCommits(['my-ws', 'my-repo', '42', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listPullRequestCommitsStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
