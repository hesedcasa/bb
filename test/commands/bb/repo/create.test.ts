/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('repo:create', () => {
  let RepoCreate: any
  let readConfigStub: SinonStub
  let createRepositoryStub: SinonStub
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
    createRepositoryStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/repo/create.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        createRepository: createRepositoryStub,
      },
      '../../../../src/config.js': {readConfig: readConfigStub},
      '../../../../src/format.js': {formatAsToon: formatAsToonStub},
    })
    RepoCreate = imported.default
  })

  it('calls createRepository with correct args and outputs JSON', async () => {
    const cmd = new RepoCreate(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(createRepositoryStub.calledOnce).to.be.true
    expect(createRepositoryStub.firstCall.args).to.deep.equal([
      mockConfig.auth,
      'my-ws',
      'my-repo',
      {description: undefined, isPrivate: false, language: undefined, projectKey: undefined},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    readConfigStub.resolves(null)

    const cmd = new RepoCreate(['my-ws', 'my-repo'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(createRepositoryStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new RepoCreate(['my-ws', 'my-repo', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(createRepositoryStub.calledOnce).to.be.true
    expect(createRepositoryStub.firstCall.args).to.deep.equal([
      mockConfig.auth,
      'my-ws',
      'my-repo',
      {description: undefined, isPrivate: false, language: undefined, projectKey: undefined},
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
