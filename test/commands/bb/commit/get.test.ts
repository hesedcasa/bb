/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('commit:get', () => {
  let CommitGet: any
  let createProfileManagerStub: SinonStub
  let getCommitStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {
    data: {author: {raw: 'SG AI Agent <dev@incube8.sg>'}, hash: 'a1b2c3d'},
    success: true,
  }

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getCommitStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/commit/index.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getCommit: getCommitStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    CommitGet = imported.default
  })

  it('calls getCommit with correct args and outputs JSON', async () => {
    const cmd = new CommitGet(['my-ws', 'my-repo', 'a1b2c3d'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getCommitStub.calledOnce).to.be.true
    expect(getCommitStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 'a1b2c3d'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes the profile flag through to the profile manager', async () => {
    const cmd = new CommitGet(['my-ws', 'my-repo', 'a1b2c3d', '--profile', 'work'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
    expect(getCommitStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new CommitGet(['my-ws', 'my-repo', 'a1b2c3d'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getCommitStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new CommitGet(['my-ws', 'my-repo', 'a1b2c3d', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(getCommitStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
