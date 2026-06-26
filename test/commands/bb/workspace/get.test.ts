/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('workspace:get', () => {
  let WorkspaceGet: any
  let createProfileManagerStub: SinonStub
  let getWorkspaceStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {name: 'My Workspace', slug: 'my-workspace'}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getWorkspaceStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/workspace/index.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getWorkspace: getWorkspaceStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    WorkspaceGet = imported.default
  })

  it('calls getWorkspace with correct args and outputs JSON', async () => {
    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceGet(['my-workspace'], oclifConfig)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getWorkspaceStub.calledOnce).to.be.true
    expect(getWorkspaceStub.firstCall.args).to.deep.equal([mockAuth, 'my-workspace'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceGet(['my-workspace'], oclifConfig)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(getWorkspaceStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const oclifConfig = {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any
    const cmd = new WorkspaceGet(['my-workspace', '--toon'], oclifConfig)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(getWorkspaceStub.calledOnce).to.be.true
    expect(getWorkspaceStub.firstCall.args).to.deep.equal([mockAuth, 'my-workspace'])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })
})
