/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('branch:create', () => {
  let BranchCreate: any
  let createProfileManagerStub: SinonStub
  let getRepositoryStub: SinonStub
  let getBranchStub: SinonStub
  let getCommitStub: SinonStub
  let createBranchStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const DEFAULT_BRANCH = 'trunk'
  const DEFAULT_TIP = 'tip-of-default-branch'
  const fullSha = 'a'.repeat(40)

  const repoSuccess = {data: {mainbranch: {name: DEFAULT_BRANCH}}, success: true}
  const branchSuccess = {data: {name: DEFAULT_BRANCH, target: {hash: DEFAULT_TIP}}, success: true}
  const commitSuccess = {data: {hash: 'canonicalized-hash'}, success: true}
  const createSuccess = {data: {name: 'feature/x', target: {hash: DEFAULT_TIP}}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    getRepositoryStub = stub().resolves(repoSuccess)
    getBranchStub = stub().resolves(branchSuccess)
    getCommitStub = stub().resolves(commitSuccess)
    createBranchStub = stub().resolves(createSuccess)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/branch/create.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        createBranch: createBranchStub,
        getBranch: getBranchStub,
        getCommit: getCommitStub,
        getRepository: getRepositoryStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    BranchCreate = imported.default
  })

  function makeCommand(argv: string[]): any {
    return new BranchCreate(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
  }

  describe('default target', () => {
    it('resolves the reported mainbranch and its tip, then posts', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])

      const result = await cmd.run()

      expect(getRepositoryStub.calledOnce).to.be.true
      expect(getRepositoryStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo'])
      expect(getBranchStub.calledOnce).to.be.true
      expect(getBranchStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', DEFAULT_BRANCH])
      expect(getCommitStub.called).to.be.false
      expect(createBranchStub.calledOnce).to.be.true
      expect(createBranchStub.firstCall.args).to.deep.equal([
        mockAuth,
        'my-ws',
        'my-repo',
        {name: 'feature/x', targetHash: DEFAULT_TIP},
      ])
      expect(result).to.deep.equal(createSuccess)
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('never falls back to a hardcoded main', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])

      await cmd.run()

      expect(getBranchStub.firstCall.args[3]).to.equal(DEFAULT_BRANCH)
      expect(createBranchStub.firstCall.args[3].targetHash).to.equal(DEFAULT_TIP)
      expect(JSON.stringify(createBranchStub.firstCall.args[3])).to.not.include('main')
    })

    it('fails with the repository lookup result unchanged', async () => {
      const failure = {error: {error: {message: 'Repository not found'}}, success: false}
      getRepositoryStub.resolves(failure)

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])
      const result = await cmd.run()

      expect(result).to.deep.equal(failure)
      expect(getBranchStub.called).to.be.false
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails when a successful repository response carries no mainbranch', async () => {
      getRepositoryStub.resolves({data: {scm: 'git'}, success: true})

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])
      const result = await cmd.run()

      expect(result.success).to.be.false
      expect(JSON.stringify(result.error)).to.include('mainbranch')
      expect(getBranchStub.called).to.be.false
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails when the default-branch lookup fails', async () => {
      const failure = {error: {error: {message: 'Not found'}}, success: false}
      getBranchStub.resolves(failure)

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])
      const result = await cmd.run()

      expect(result).to.deep.equal(failure)
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails when the default branch response carries no target hash', async () => {
      getBranchStub.resolves({data: {name: DEFAULT_BRANCH}, success: true})

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])
      const result = await cmd.run()

      expect(result.success).to.be.false
      expect(JSON.stringify(result.error)).to.include('target hash')
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })
  })

  describe('explicit branch target', () => {
    it('resolves a slash-containing branch name and never reads the repository', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', 'feature/x'])

      const result = await cmd.run()

      expect(getRepositoryStub.called).to.be.false
      expect(getCommitStub.called).to.be.false
      expect(getBranchStub.calledOnce).to.be.true
      expect(getBranchStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', 'feature/x'])
      expect(createBranchStub.firstCall.args).to.deep.equal([
        mockAuth,
        'my-ws',
        'my-repo',
        {name: 'child', targetHash: DEFAULT_TIP},
      ])
      expect(result).to.deep.equal(createSuccess)
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails with the branch lookup result unchanged', async () => {
      const failure = {error: {error: {message: 'Not found'}}, success: false}
      getBranchStub.resolves(failure)

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', 'ghost'])
      const result = await cmd.run()

      expect(result).to.deep.equal(failure)
      expect(getRepositoryStub.called).to.be.false
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails when the branch response carries no target hash', async () => {
      getBranchStub.resolves({data: {name: 'ghost'}, success: true})

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', 'ghost'])
      const result = await cmd.run()

      expect(result.success).to.be.false
      expect(JSON.stringify(result.error)).to.include('target hash')
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })
  })

  describe('explicit commit target', () => {
    it('resolves a full 40-character hash through getCommit and canonicalizes it', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', fullSha])

      const result = await cmd.run()

      expect(getRepositoryStub.called).to.be.false
      expect(getBranchStub.called).to.be.false
      expect(getCommitStub.calledOnce).to.be.true
      expect(getCommitStub.firstCall.args).to.deep.equal([mockAuth, 'my-ws', 'my-repo', fullSha])
      expect(createBranchStub.firstCall.args).to.deep.equal([
        mockAuth,
        'my-ws',
        'my-repo',
        {name: 'child', targetHash: 'canonicalized-hash'},
      ])
      expect(result).to.deep.equal(createSuccess)
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('resolves an abbreviated hash through getCommit', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', 'abc123d'])

      await cmd.run()

      expect(getCommitStub.calledOnce).to.be.true
      expect(getCommitStub.firstCall.args[3]).to.equal('abc123d')
      expect(createBranchStub.firstCall.args[3].targetHash).to.equal('canonicalized-hash')
    })

    it('fails with the commit lookup result unchanged', async () => {
      const failure = {error: {error: {message: 'Commit not found'}}, success: false}
      getCommitStub.resolves(failure)

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', fullSha])
      const result = await cmd.run()

      expect(result).to.deep.equal(failure)
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('fails when the commit response carries no hash', async () => {
      getCommitStub.resolves({data: {message: 'ok'}, success: true})

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'child', '--target', fullSha])
      const result = await cmd.run()

      expect(result.success).to.be.false
      expect(JSON.stringify(result.error)).to.include('hash')
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })
  })

  describe('argument handling', () => {
    it('throws when --name is missing', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo'])

      try {
        await cmd.run()
        expect.fail('should have thrown')
      } catch {
        // expected parse error
      }

      expect(getRepositoryStub.called).to.be.false
      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.called).to.be.false
    })

    it('throws when repoSlug is missing', async () => {
      const cmd = makeCommand(['my-ws', '--name', 'feature/x'])

      try {
        await cmd.run()
        expect.fail('should have thrown')
      } catch {
        // expected parse error
      }

      expect(getRepositoryStub.called).to.be.false
      expect(clearClientsStub.called).to.be.false
    })

    it('returns early when config is missing', async () => {
      createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])

      try {
        await cmd.run()
      } catch {
        // expected error when config is missing
      }

      expect(createProfileManagerStub.calledOnce).to.be.true
      expect(getRepositoryStub.called).to.be.false
      expect(clearClientsStub.called).to.be.false
    })

    it('passes a named profile through to the profile manager', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x', '-p', 'work'])

      await cmd.run()

      expect(createProfileManagerStub.firstCall.args[1]).to.equal('work')
      expect(createBranchStub.calledOnce).to.be.true
    })
  })

  describe('failure handling', () => {
    it('returns a failed create result unchanged and formats it for TOON', async () => {
      const failure = {error: {error: {message: 'You are not permitted'}}, success: false}
      createBranchStub.resolves(failure)

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x', '--toon'])
      const logStub = stub(cmd, 'log')

      const result = await cmd.run()

      expect(result).to.deep.equal(failure)
      expect(clearClientsStub.calledOnce).to.be.true
      expect(formatAsToonStub.calledOnce).to.be.true
      expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(failure)
      expect(logStub.calledWith('toon-output')).to.be.true
    })

    it('still clears clients when a mocked client throws unexpectedly', async () => {
      getRepositoryStub.rejects(new Error('transport blew up'))

      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])

      try {
        await cmd.run()
        expect.fail('should have thrown')
      } catch {
        // expected unexpected-exception path
      }

      expect(createBranchStub.called).to.be.false
      expect(clearClientsStub.calledOnce).to.be.true
    })

    it('outputs JSON mode without logging', async () => {
      const cmd = makeCommand(['my-ws', 'my-repo', '--name', 'feature/x'])
      const logStub = stub(cmd, 'log')

      await cmd.run()

      expect(logStub.called).to.be.false
    })
  })
})
