/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('workspace:list', () => {
  let WorkspaceList: any
  let readConfigStub: SinonStub
  let listWorkspacesStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockConfig = {
    auth: {
      apiToken: 'test-token',
      email: 'test@example.com',
      host: 'https://bitbucket.org',
    },
  }

  const mockResult = {
    data: {values: [{slug: 'ws-1'}, {slug: 'ws-2'}]},
    success: true,
  }

  beforeEach(async () => {
    readConfigStub = stub().resolves(mockConfig)
    listWorkspacesStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/workspace/list.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        listWorkspaces: listWorkspacesStub,
      },
      '../../../../src/config.js': {readConfig: readConfigStub},
      '../../../../src/format.js': {formatAsToon: formatAsToonStub},
    })
    WorkspaceList = imported.default
  })

  it('calls listWorkspaces with correct args and outputs JSON', async () => {
    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceList([], oclifConfig)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(listWorkspacesStub.calledOnce).to.be.true
    expect(listWorkspacesStub.firstCall.args).to.deep.equal([mockConfig.auth, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(logJsonStub.calledOnce).to.be.true
    expect(logJsonStub.firstCall.args[0]).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    readConfigStub.resolves(null)

    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceList([], oclifConfig)
    const logJsonStub = stub(cmd, 'logJson')

    await cmd.run()

    expect(readConfigStub.calledOnce).to.be.true
    expect(listWorkspacesStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
    expect(logJsonStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceList(['--toon'], oclifConfig)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(listWorkspacesStub.calledOnce).to.be.true
    expect(listWorkspacesStub.firstCall.args).to.deep.equal([mockConfig.auth, 1, 10])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
