/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('auth:test', () => {
  let AuthTest: any
  let fsStub: Record<string, SinonStub>
  let testConnectionStub: SinonStub
  let clearClientsStub: SinonStub
  let actionStartStub: SinonStub
  let actionStopStub: SinonStub

  const mockProfileData = {
    profiles: {
      default: {apiToken: 'test-token', email: 'test@example.com', host: 'https://bitbucket.org'},
    },
  }

  beforeEach(async () => {
    fsStub = {
      readJSON: stub().resolves(mockProfileData),
    }
    testConnectionStub = stub()
    clearClientsStub = stub()
    actionStartStub = stub()
    actionStopStub = stub()

    const imported = await esmock('../../../../src/commands/bb/auth/test.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })
    AuthTest = imported.default
  })

  it('shows success on valid connection', async () => {
    testConnectionStub.resolves({data: {username: 'user'}, success: true})

    const cmd = new AuthTest([], {
      bin: 'bb',
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    const result = await cmd.run()

    expect(testConnectionStub.calledWith(mockProfileData.profiles.default)).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(actionStopStub.calledWith('✓ successful')).to.be.true
    expect(logStub.calledWith('Successful connection to Bitbucket')).to.be.true
    expect(result.success).to.be.true
  })

  it('uses correct profile when --profile flag is given', async () => {
    fsStub.readJSON.resolves({
      profiles: {
        default: {apiToken: 'default-token', host: 'https://bitbucket.org'},
        work: {apiToken: 'work-token', email: 'work@example.com', host: 'https://bitbucket.org'},
      },
    })
    testConnectionStub.resolves({data: {}, success: true})

    const imported = await esmock('../../../../src/commands/bb/auth/test.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        testConnection: testConnectionStub,
      },
      '@oclif/core/ux': {action: {start: actionStartStub, stop: actionStopStub}},
      'fs-extra': {default: fsStub},
    })

    const cmd = new imported.default(['--profile', 'work'], {
      bin: 'bb',
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')

    await cmd.run()

    expect(testConnectionStub.firstCall.args[0].apiToken).to.equal('work-token')
  })

  it('shows error on failed connection', async () => {
    testConnectionStub.resolves({error: 'Unauthorized', success: false})

    const cmd = new AuthTest([], {
      bin: 'bb',
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')
    const errorStub = stub(cmd, 'error')

    await cmd.run()

    expect(actionStopStub.calledWith('✗ failed')).to.be.true
    expect(errorStub.calledWith('Failed to connect to Bitbucket.')).to.be.true
  })

  it('throws error when config is missing', async () => {
    fsStub.readJSON.rejects(Object.assign(new Error('ENOENT: no such file or directory'), {code: 'ENOENT'}))

    const cmd = new AuthTest([], {
      bin: 'bb',
      configDir: '/tmp/test-config',
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')
    const errorStub = stub(cmd, 'error').throws()

    try {
      await cmd.run()
    } catch {
      // Expected
    }

    expect(errorStub.calledOnce).to.be.true
    expect(errorStub.firstCall.args[0]).to.include('Missing authentication config')
    expect(testConnectionStub.called).to.be.false
  })
})
