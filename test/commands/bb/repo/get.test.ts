/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('repo:get', () => {
  let RepoGet: any
  let createProfileManagerStub: SinonStub
  let getRepositoryStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  // eslint-disable-next-line camelcase
  const mockResult = {data: {full_name: 'my-ws/my-repo', slug: 'my-repo'}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getRepositoryStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/repo/get.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getRepository: getRepositoryStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    RepoGet = imported.default
  })

  it('calls getRepository with correct args and outputs JSON', async () => {
    const cmd = new RepoGet(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getRepositoryStub.calledOnce).to.be.true
    expect(getRepositoryStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new RepoGet(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getRepositoryStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new RepoGet(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(getRepositoryStub.calledOnce).to.be.true
    expect(getRepositoryStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
