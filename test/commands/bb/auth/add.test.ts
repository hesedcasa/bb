/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
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
      outputJSON: stub().resolves(),
      readJSON: stub().rejects(new Error('ENOENT: no such file or directory')),
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

    const cmd = new AuthAdd(['-t', 'my-token', '-e', 'user@test.com', '-p', 'default'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(fsStub.outputJSON.calledOnce).to.be.true
    const writtenData = fsStub.outputJSON.firstCall.args[1]
    expect(writtenData.profiles.default.apiToken).to.equal('my-token')
    expect(writtenData.profiles.default.email).to.equal('user@test.com')
    expect(testConnectionStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(actionStopStub.calledWith('✓ successful')).to.be.true
    expect(logStub.calledWith('Authentication added successfully')).to.be.true
    expect(result.success).to.be.true
  })

  it('writes config with owner-only permissions', async () => {
    testConnectionStub.resolves({data: {}, success: true})

    const cmd = new AuthAdd(['-t', 'tok', '-e', 'e@e.com', '-p', 'default'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    const writeOptions = fsStub.outputJSON.firstCall.args[2]
    expect(writeOptions.mode).to.equal(0o600)
  })

  it('converts old-format auth to default profile before saving', async () => {
    let writtenData: any = null

    fsStub.outputJSON.callsFake((_path: string, data: any) => {
      writtenData = data
      return Promise.resolve()
    })
    fsStub.readJSON.resolves({
      auth: {apiToken: 'existing-token', email: 'existing@test.com'},
    })

    testConnectionStub.resolves({data: {}, success: true})

    const imported = await esmock('../../../../src/commands/bb/auth/add.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['-t', 'new-token', '-e', 'new@test.com', '-p', 'work'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    expect(writtenData.profiles.default).to.deep.equal({
      apiToken: 'existing-token',
      email: 'existing@test.com',
    })
    expect(writtenData.profiles.work).to.deep.equal({
      apiToken: 'new-token',
      email: 'new@test.com',
    })
    expect(writtenData.auth).to.be.undefined
  })

  it('errors when adding a profile that already exists', async () => {
    fsStub.readJSON.resolves({
      profiles: {
        default: {apiToken: 'existing-token', email: 'existing@test.com'},
      },
    })

    const imported = await esmock('../../../../src/commands/bb/auth/add.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['-t', 'new-token', '-e', 'new@test.com', '-p', 'default'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    let errorThrown = false
    cmd.error = (msg: string) => {
      errorThrown = true
      expect(msg).to.include("Profile 'default' already exists")
      throw new Error(msg)
    }

    try {
      await cmd.run()
    } catch {
      // expected
    }

    expect(errorThrown).to.be.true
  })

  it('errors when adding default profile to old-format config', async () => {
    fsStub.readJSON.resolves({
      auth: {apiToken: 'test-token', email: 'test@test.com'},
    })

    const imported = await esmock('../../../../src/commands/bb/auth/add.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['-t', 'new-token', '-e', 'new@test.com', '-p', 'default'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    let errorThrown = false
    cmd.error = (msg: string) => {
      errorThrown = true
      expect(msg).to.include("Profile 'default' already exists")
      throw new Error(msg)
    }

    try {
      await cmd.run()
    } catch {
      // expected
    }

    expect(errorThrown).to.be.true
  })

  it('shows error on failed auth test', async () => {
    testConnectionStub.resolves({error: 'Unauthorized', success: false})

    const cmd = new AuthAdd(['-t', 'bad', '-e', 'e@e.com', '-p', 'work'], {
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

  it('calls clearClients after execution', async () => {
    testConnectionStub.resolves({data: {}, success: true})

    const cmd = new AuthAdd(['-t', 'tok', '-e', 'e@e.com', '-p', 'work'], {
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    expect(clearClientsStub.calledOnce).to.be.true
  })
})
