/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('commit:list', () => {
  let CommitList: any
  let createProfileManagerStub: SinonStub
  let listCommitsStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {values: [{hash: 'aaa111'}, {hash: 'bbb222'}]}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listCommitsStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/commit/list.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listCommits: listCommitsStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    CommitList = imported.default
  })

  it('calls listCommits with correct args and outputs JSON', async () => {
    const cmd = new CommitList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listCommitsStub.calledOnce).to.be.true
    expect(listCommitsStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 1, 10, undefined, undefined])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes a single include/exclude pair and pagination through', async () => {
    const cmd = new CommitList(
      ['my-ws', 'my-repo', '--include', 'feature-x', '--exclude', 'master', '--page', '2', '--pagelen', '25'],
      {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any,
    )

    await cmd.run()

    expect(listCommitsStub.calledOnce).to.be.true
    expect(listCommitsStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      2,
      25,
      ['feature-x'],
      ['master'],
    ])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('collects repeated --include and --exclude flags into arrays', async () => {
    const cmd = new CommitList(
      ['my-ws', 'my-repo', '--include', 'aaa111', '--include', 'bbb222', '--exclude', 'ccc333'],
      {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any,
    )

    await cmd.run()

    expect(listCommitsStub.calledOnce).to.be.true
    expect(listCommitsStub.firstCall.args[5]).to.deep.equal(['aaa111', 'bbb222'])
    expect(listCommitsStub.firstCall.args[6]).to.deep.equal(['ccc333'])
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new CommitList(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listCommitsStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new CommitList(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listCommitsStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
