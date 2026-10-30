/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('branch:get', () => {
  let BranchGet: any
  let createProfileManagerStub: SinonStub
  let getBranchStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {name: 'feature/x', target: {hash: 'abc123'}}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getBranchStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/branch/index.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getBranch: getBranchStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    BranchGet = imported.default
  })

  function makeCommand(argv: string[]): any {
    return new BranchGet(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
  }

  it('calls getBranch with positionally parsed args and outputs JSON', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', 'feature/x'])
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(createProfileManagerStub.firstCall.args[1]).to.be.undefined
    expect(getBranchStub.calledOnce).to.be.true
    expect(getBranchStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 'feature/x'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
    // JSON mode serializes the return value; the command must not log it too.
    expect(logStub.called).to.be.false
  })

  it('passes a raw slash-containing branch name through unencoded', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', 'feature/deep/name'])

    await cmd.run()

    expect(getBranchStub.firstCall.args[3]).to.equal('feature/deep/name')
  })

  it('passes a named profile through to the profile manager', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', 'main', '-p', 'work'])

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
    expect(getBranchStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('accepts the long --profile spelling', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', 'main', '--profile', 'work'])

    await cmd.run()

    expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = makeCommand(['my-ws', 'my-repo', 'main'])

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getBranchStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('throws when the branch argument is missing', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo'])

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch {
      // expected parse error
    }

    expect(getBranchStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('returns a failed result unchanged', async () => {
    const failure = {error: {error: {message: 'Not found'}}, success: false}
    getBranchStub.resolves(failure)

    const cmd = makeCommand(['my-ws', 'my-repo', 'nope'])
    const result = await cmd.run()

    expect(result).to.deep.equal(failure)
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = makeCommand(['my-ws', 'my-repo', 'feature/x', '--toon'])
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(getBranchStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
