/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('auth:update', () => {
  let AuthUpdate: any
  let testConnectionStub: SinonStub
  let clearClientsStub: SinonStub
  let fsStub: Record<string, SinonStub>
  let confirmStub: SinonStub
  let actionStartStub: SinonStub
  let actionStopStub: SinonStub

  const existingConfig = {auth: {apiToken: 'old-token', email: 'old@test.com'}}

  beforeEach(async () => {
    testConnectionStub = stub()
    clearClientsStub = stub()
    confirmStub = stub().resolves(true)
    actionStartStub = stub()
    actionStopStub = stub()
    fsStub = {
      readJSON: stub().resolves(existingConfig),
      writeJSON: stub().resolves(),
    }

    const imported = await esmock('../../../../src/commands/bb/auth/update.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@inquirer/prompts': {confirm: confirmStub, input: stub()},
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })
    AuthUpdate = imported.default
  })

  it('updates config and shows success on valid auth', async () => {
    testConnectionStub.resolves({data: {username: 'user'}, success: true})

    const cmd = new AuthUpdate(['-t', 'new-token', '-e', 'new@test.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(confirmStub.calledOnce).to.be.true
    expect(fsStub.writeJSON.calledOnce).to.be.true
    const writtenData = fsStub.writeJSON.firstCall.args[1]
    expect(writtenData.profiles.default.apiToken).to.equal('new-token')
    expect(writtenData.profiles.default.email).to.equal('new@test.com')
    expect(testConnectionStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(actionStopStub.calledWith('✓ successful')).to.be.true
    expect(logStub.calledWith('Authentication updated successfully')).to.be.true
    expect(result.success).to.be.true
  })

  it('updates a named profile', async () => {
    let writtenData: any = null

    fsStub.readJSON.resolves({
      profiles: {
        default: {apiToken: 'default-token', email: 'default@test.com'},
        work: {apiToken: 'old-work-token', email: 'work@test.com'},
      },
    })
    fsStub.writeJSON.callsFake((_path: string, data: any) => {
      writtenData = data
      return Promise.resolve()
    })

    testConnectionStub.resolves({data: {username: 'user'}, success: true})

    const imported = await esmock('../../../../src/commands/bb/auth/update.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@inquirer/prompts': {confirm: confirmStub, input: stub()},
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['-t', 'new-work-token', '-e', 'new-work@test.com', '-p', 'work'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(result.success).to.be.true
    expect(writtenData.profiles.work.apiToken).to.equal('new-work-token')
    expect(writtenData.profiles.default.apiToken).to.equal('default-token')
    expect(logStub.calledWith("Authentication for profile 'work' updated successfully")).to.be.true
  })

  it('returns early when user declines confirmation', async () => {
    confirmStub.resolves(false)

    const cmd = new AuthUpdate(['-t', 'tok', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    const result = await cmd.run()

    expect(fsStub.writeJSON.called).to.be.false
    expect(testConnectionStub.called).to.be.false
    expect(result).to.be.undefined
  })

  it('shows "Run auth:add" when config file not found', async () => {
    fsStub.readJSON.rejects(new Error('ENOENT: no such file or directory'))

    const cmd = new AuthUpdate(['-t', 'tok', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(logStub.calledWith('Run auth:add instead')).to.be.true
    expect(fsStub.writeJSON.called).to.be.false
  })

  it('shows error message for other read errors', async () => {
    fsStub.readJSON.rejects(new Error('Permission denied'))

    const cmd = new AuthUpdate(['-t', 'tok', '-e', 'e@e.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(logStub.calledWith('Permission denied')).to.be.true
    expect(fsStub.writeJSON.called).to.be.false
  })

  it('errors when updating a non-existent profile', async () => {
    fsStub.readJSON.resolves({
      profiles: {
        default: {apiToken: 'default-token', email: 'default@test.com'},
      },
    })

    const imported = await esmock('../../../../src/commands/bb/auth/update.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@inquirer/prompts': {confirm: confirmStub, input: stub()},
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['-t', 'tok', '-e', 'e@e.com', '-p', 'nonexistent'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'error').callsFake((msg: any) => {
      throw new Error(msg)
    })

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.equal("Profile 'nonexistent' does not exist. Use auth:add to create it.")
    }

    expect(fsStub.writeJSON.called).to.be.false
  })

  it('removes legacy auth block when updating config', async () => {
    testConnectionStub.resolves({data: {username: 'user'}, success: true})

    const cmd = new AuthUpdate(['-t', 'new-token', '-e', 'new@test.com'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    const writtenData = fsStub.writeJSON.firstCall.args[1]
    expect(writtenData.auth).to.be.undefined
    expect(writtenData.profiles.default.apiToken).to.equal('new-token')
  })

  it('shows error on failed auth test after update', async () => {
    testConnectionStub.resolves({error: 'Unauthorized', success: false})

    const cmd = new AuthUpdate(['-t', 'bad', '-e', 'e@e.com'], {
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
})
