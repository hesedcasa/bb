/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('branch:list', () => {
  let BranchList: any
  let createProfileManagerStub: SinonStub
  let listBranchesStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {next: 'https://api.bitbucket.org/2.0/x?page=2', values: [{name: 'main'}]}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    listBranchesStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/branch/list.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listBranches: listBranchesStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    BranchList = imported.default
  })

  function makeCommand(argv: string[]): any {
    return new BranchList(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
  }

  it('calls listBranches with defaults and outputs JSON', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo'])
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listBranchesStub.calledOnce).to.be.true
    expect(listBranchesStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      {page: 1, pagelen: 10, q: undefined, sort: undefined},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
    // JSON mode serializes the return value; the command must not log it too.
    expect(logStub.called).to.be.false
  })

  it('passes explicit page and pagelen through', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '--page', '2', '--pagelen', '25'])

    await cmd.run()

    expect(listBranchesStub.firstCall.args[3]).to.deep.include({page: 2, pagelen: 25})
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('passes q and sort through individually', async () => {
    const withQ = makeCommand(['my-ws', 'my-repo', '--q', 'name ~ "feature/x"'])
    await withQ.run()
    expect(listBranchesStub.firstCall.args[3]).to.deep.include({q: 'name ~ "feature/x"', sort: undefined})

    const withSort = makeCommand(['my-ws', 'my-repo', '--sort', '-name'])
    await withSort.run()
    expect(listBranchesStub.secondCall.args[3]).to.deep.include({q: undefined, sort: '-name'})
  })

  it('passes q and sort together', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '--q', 'name ~ "e2e"', '--sort', 'name'])

    await cmd.run()

    expect(listBranchesStub.firstCall.args[3]).to.deep.include({q: 'name ~ "e2e"', sort: 'name'})
  })

  it('passes a named profile through to the profile manager', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '-p', 'work'])

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
    expect(listBranchesStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = makeCommand(['my-ws', 'my-repo'])

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(listBranchesStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('throws when repoSlug is missing', async () => {
    const cmd = makeCommand(['my-ws'])

    let caught: unknown
    try {
      await cmd.run()
    } catch (error: unknown) {
      caught = error
    }

    expect(caught).to.be.instanceOf(Error)
    expect(listBranchesStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('throws when --page is not an integer', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '--page', 'abc'])

    let caught: unknown
    try {
      await cmd.run()
    } catch (error: unknown) {
      caught = error
    }

    expect(caught).to.be.instanceOf(Error)
    expect(listBranchesStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('returns a failed result unchanged', async () => {
    const failure = {error: {error: {message: 'Repository not found'}}, success: false}
    listBranchesStub.resolves(failure)

    const cmd = makeCommand(['my-ws', 'my-repo'])
    const result = await cmd.run()

    expect(result).to.deep.equal(failure)
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', '--toon'])
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listBranchesStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
