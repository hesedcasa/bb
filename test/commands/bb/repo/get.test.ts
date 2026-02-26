/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('repo:get', () => {
  let RepoGet: any
  let readConfigStub: SinonStub
  let getRepositoryStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockConfig = {
    auth: {
      apiToken: 'test-token',
      email: 'test@example.com',
      host: 'https://bitbucket.org',
    },
  }

  // eslint-disable-next-line camelcase
  const mockResult = {data: {full_name: 'my-ws/my-repo', slug: 'my-repo'}, success: true}

  beforeEach(async () => {
    readConfigStub = stub().resolves(mockConfig)
    getRepositoryStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/repo/get.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getRepository: getRepositoryStub,
      },
      '../../../../src/config.js': {readConfig: readConfigStub},
      '../../../../src/format.js': {formatAsToon: formatAsToonStub},
    })
    RepoGet = imported.default
  })

  it('calls getRepository with correct args and outputs JSON', async () => {
    const cmd = new RepoGet(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(getRepositoryStub.calledOnce).to.be.true
    expect(getRepositoryStub.firstCall.args).to.deep.equal([mockConfig.auth, 'my-ws', 'my-repo'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    readConfigStub.resolves(null)

    const cmd = new RepoGet(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(getRepositoryStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new RepoGet(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(getRepositoryStub.calledOnce).to.be.true
    expect(getRepositoryStub.firstCall.args).to.deep.equal([mockConfig.auth, 'my-ws', 'my-repo'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
