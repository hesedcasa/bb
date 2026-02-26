/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('auth:add', () => {
  let AuthAdd: any
  let testConnectionStub: SinonStub
  let clearClientsStub: SinonStub
  let fsStub: Record<string, SinonStub>
  let actionStartStub: SinonStub
  let actionStopStub: SinonStub

  beforeEach(async () => {
    testConnectionStub = stub()
    clearClientsStub = stub()
    actionStartStub = stub()
    actionStopStub = stub()
    fsStub = {
      createFile: stub().resolves(),
      pathExists: stub().resolves(false),
      readJSON: stub().resolves({auth: {apiToken: 'tok', email: 'e@e.com'}}),
      writeJSON: stub().resolves(),
    }

    const imported = await esmock('../../../../src/commands/bb/auth/add.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })
    AuthAdd = imported.default
  })

  it('writes config and shows success on valid auth', async () => {
    testConnectionStub.resolves({data: {username: 'user'}, success: true})

    const cmd = new AuthAdd(['-t', 'my-token', '-e', 'user@test.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(fsStub.pathExists.calledOnce).to.be.true
    expect(fsStub.createFile.calledOnce).to.be.true
    expect(fsStub.writeJSON.calledOnce).to.be.true
    const writtenData = fsStub.writeJSON.firstCall.args[1]
    expect(writtenData.auth.apiToken).to.equal('my-token')
    expect(writtenData.auth.email).to.equal('user@test.com')
    expect(testConnectionStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(actionStopStub.calledWith('✓ successful')).to.be.true
    expect(logStub.calledWith('Authentication added successfully')).to.be.true
    expect(result.success).to.be.true
  })

  it('does not create file if config already exists', async () => {
    fsStub.pathExists.resolves(true)
    testConnectionStub.resolves({data: {}, success: true})

    const cmd = new AuthAdd(['-t', 'tok', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    expect(fsStub.createFile.called).to.be.false
    expect(fsStub.writeJSON.calledOnce).to.be.true
  })

  it('shows error on failed auth test', async () => {
    testConnectionStub.resolves({error: 'Unauthorized', success: false})

    const cmd = new AuthAdd(['-t', 'bad', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')
    const errorStub = stub(cmd, 'error')

    await cmd.run()

    expect(actionStopStub.calledWith('✗ failed')).to.be.true
    expect(errorStub.calledWith('Authentication is invalid. Please check your email, API Token, and URL.')).to.be.true
  })

  it('writes config with owner-only permissions', async () => {
    testConnectionStub.resolves({data: {}, success: true})

    const cmd = new AuthAdd(['-t', 'tok', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    const writeOptions = fsStub.writeJSON.firstCall.args[2]
    expect(writeOptions.mode).to.equal(0o600)
  })
})
