/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('bitbucket-client', () => {
  const mockConfig = {apiToken: 'test-token', email: 'test@example.com', host: 'https://bitbucket.org'}
  const mockResult = {data: {test: true}, success: true}
  let clearClients: any
  let testConnectionFn: any
  let listWorkspacesFn: any
  let getWorkspaceFn: any
  let listRepositoriesFn: any
  let getRepositoryFn: any
  let createRepositoryFn: any
  let deleteRepositoryFn: any
  let listPullRequestsFn: any
  let getPullRequestFn: any
  let createPullRequestFn: any
  let updatePullRequestFn: any
  let mergePullRequestFn: any
  let declinePullRequestFn: any
  let approvePullRequestFn: any
  let unapprovePullRequestFn: any
  let listPipelinesFn: any
  let getPipelineFn: any
  let triggerPipelineFn: any

  let mockApiInstance: Record<string, SinonStub>
  let BitbucketApiStub: SinonStub

  beforeEach(async () => {
    mockApiInstance = {
      approvePullRequest: stub().resolves(mockResult),
      clearClients: stub(),
      createPullRequest: stub().resolves(mockResult),
      createRepository: stub().resolves(mockResult),
      declinePullRequest: stub().resolves(mockResult),
      deleteRepository: stub().resolves(mockResult),
      getPipeline: stub().resolves(mockResult),
      getPullRequest: stub().resolves(mockResult),
      getRepository: stub().resolves(mockResult),
      getWorkspace: stub().resolves(mockResult),
      listPipelines: stub().resolves(mockResult),
      listPullRequests: stub().resolves(mockResult),
      listRepositories: stub().resolves(mockResult),
      listWorkspaces: stub().resolves(mockResult),
      mergePullRequest: stub().resolves(mockResult),
      testConnection: stub().resolves(mockResult),
      triggerPipeline: stub().resolves(mockResult),
      unapprovePullRequest: stub().resolves(mockResult),
      updatePullRequest: stub().resolves(mockResult),
    }
    BitbucketApiStub = stub().returns(mockApiInstance)

    const mod = await esmock('../../src/bitbucket/bitbucket-client.js', {
      '../../src/bitbucket/bitbucket-api.js': {BitbucketApi: BitbucketApiStub},
    })

    clearClients = mod.clearClients
    testConnectionFn = mod.testConnection
    listWorkspacesFn = mod.listWorkspaces
    getWorkspaceFn = mod.getWorkspace
    listRepositoriesFn = mod.listRepositories
    getRepositoryFn = mod.getRepository
    createRepositoryFn = mod.createRepository
    deleteRepositoryFn = mod.deleteRepository
    listPullRequestsFn = mod.listPullRequests
    getPullRequestFn = mod.getPullRequest
    createPullRequestFn = mod.createPullRequest
    updatePullRequestFn = mod.updatePullRequest
    mergePullRequestFn = mod.mergePullRequest
    declinePullRequestFn = mod.declinePullRequest
    approvePullRequestFn = mod.approvePullRequest
    unapprovePullRequestFn = mod.unapprovePullRequest
    listPipelinesFn = mod.listPipelines
    getPipelineFn = mod.getPipeline
    triggerPipelineFn = mod.triggerPipeline
  })

  afterEach(() => {
    clearClients()
  })

  it('clearClients does not throw', () => {
    expect(() => clearClients()).to.not.throw()
  })

  describe('singleton pattern', () => {
    it('reuses the same BitbucketApi instance on subsequent calls', async () => {
      await testConnectionFn(mockConfig)
      await testConnectionFn(mockConfig)

      expect(BitbucketApiStub.calledOnce).to.be.true
    })

    it('creates a new instance after clearClients', async () => {
      await testConnectionFn(mockConfig)
      clearClients()
      await testConnectionFn(mockConfig)

      expect(BitbucketApiStub.calledTwice).to.be.true
    })
  })

  describe('initBitbucket error handling', () => {
    it('wraps constructor errors', async () => {
      const failMod = await esmock('../../src/bitbucket/bitbucket-client.js', {
        '../../src/bitbucket/bitbucket-api.js': {
          BitbucketApi: stub().throws(new Error('init failed')),
        },
      })

      try {
        await failMod.testConnection(mockConfig)
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.include('Failed to initialize Bitbucket client')
        expect((error as Error).message).to.include('init failed')
      }
    })

    it('wraps non-Error constructor exceptions', async () => {
      const failMod = await esmock('../../src/bitbucket/bitbucket-client.js', {
        '../../src/bitbucket/bitbucket-api.js': {
          BitbucketApi: stub().throws('string error'),
        },
      })

      try {
        await failMod.testConnection(mockConfig)
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.include('Failed to initialize Bitbucket client')
      }
    })
  })

  describe('testConnection', () => {
    it('delegates to BitbucketApi.testConnection', async () => {
      const result = await testConnectionFn(mockConfig)
      expect(mockApiInstance.testConnection.calledOnce).to.be.true
      expect(result).to.deep.equal(mockResult)
    })
  })

  describe('listWorkspaces', () => {
    it('delegates with pagination params', async () => {
      await listWorkspacesFn(mockConfig, 2, 25)
      expect(mockApiInstance.listWorkspaces.calledWith(2, 25)).to.be.true
    })

    it('uses defaults for pagination', async () => {
      await listWorkspacesFn(mockConfig)
      expect(mockApiInstance.listWorkspaces.calledWith(1, 10)).to.be.true
    })
  })

  describe('getWorkspace', () => {
    it('delegates with workspace arg', async () => {
      await getWorkspaceFn(mockConfig, 'my-ws')
      expect(mockApiInstance.getWorkspace.calledWith('my-ws')).to.be.true
    })
  })

  describe('listRepositories', () => {
    it('delegates with all params', async () => {
      await listRepositoriesFn(mockConfig, 'ws', 2, 20, 'admin', 'q=test')
      expect(mockApiInstance.listRepositories.calledWith('ws', 2, 20, 'admin', 'q=test')).to.be.true
    })
  })

  describe('getRepository', () => {
    it('delegates with workspace and repoSlug', async () => {
      await getRepositoryFn(mockConfig, 'ws', 'repo')
      expect(mockApiInstance.getRepository.calledWith('ws', 'repo')).to.be.true
    })
  })

  describe('createRepository', () => {
    it('delegates with options', async () => {
      const opts = {description: 'desc', isPrivate: true}
      await createRepositoryFn(mockConfig, 'ws', 'repo', opts)
      expect(mockApiInstance.createRepository.calledWith('ws', 'repo', opts)).to.be.true
    })
  })

  describe('deleteRepository', () => {
    it('delegates with workspace and repoSlug', async () => {
      await deleteRepositoryFn(mockConfig, 'ws', 'repo')
      expect(mockApiInstance.deleteRepository.calledWith('ws', 'repo')).to.be.true
    })
  })

  describe('listPullRequests', () => {
    it('delegates with all params', async () => {
      await listPullRequestsFn(mockConfig, 'ws', 'repo', 'OPEN', 3, 15)
      expect(mockApiInstance.listPullRequests.calledWith('ws', 'repo', 'OPEN', 3, 15)).to.be.true
    })
  })

  describe('getPullRequest', () => {
    it('delegates with workspace, repo, and id', async () => {
      await getPullRequestFn(mockConfig, 'ws', 'repo', 42)
      expect(mockApiInstance.getPullRequest.calledWith('ws', 'repo', 42)).to.be.true
    })
  })

  describe('createPullRequest', () => {
    it('delegates with all params', async () => {
      await createPullRequestFn(mockConfig, 'ws', 'repo', 'title', 'src', 'dst', 'desc', true, ['r1'])
      expect(mockApiInstance.createPullRequest.calledWith('ws', 'repo', 'title', 'src', 'dst', 'desc', true, ['r1'])).to
        .be.true
    })
  })

  describe('updatePullRequest', () => {
    it('delegates with fields', async () => {
      const fields = {title: 'updated'}
      await updatePullRequestFn(mockConfig, 'ws', 'repo', 1, fields)
      expect(mockApiInstance.updatePullRequest.calledWith('ws', 'repo', 1, fields)).to.be.true
    })
  })

  describe('mergePullRequest', () => {
    it('delegates with all params', async () => {
      await mergePullRequestFn(mockConfig, 'ws', 'repo', 1, 'squash', true, 'msg')
      expect(mockApiInstance.mergePullRequest.calledWith('ws', 'repo', 1, 'squash', true, 'msg')).to.be.true
    })
  })

  describe('declinePullRequest', () => {
    it('delegates to api', async () => {
      await declinePullRequestFn(mockConfig, 'ws', 'repo', 5)
      expect(mockApiInstance.declinePullRequest.calledWith('ws', 'repo', 5)).to.be.true
    })
  })

  describe('approvePullRequest', () => {
    it('delegates to api', async () => {
      await approvePullRequestFn(mockConfig, 'ws', 'repo', 7)
      expect(mockApiInstance.approvePullRequest.calledWith('ws', 'repo', 7)).to.be.true
    })
  })

  describe('unapprovePullRequest', () => {
    it('delegates to api', async () => {
      await unapprovePullRequestFn(mockConfig, 'ws', 'repo', 7)
      expect(mockApiInstance.unapprovePullRequest.calledWith('ws', 'repo', 7)).to.be.true
    })
  })

  describe('listPipelines', () => {
    it('delegates with all params', async () => {
      await listPipelinesFn(mockConfig, 'ws', 'repo', 2, 20, '-created_on')
      expect(mockApiInstance.listPipelines.calledWith('ws', 'repo', 2, 20, '-created_on')).to.be.true
    })
  })

  describe('getPipeline', () => {
    it('delegates to api', async () => {
      await getPipelineFn(mockConfig, 'ws', 'repo', '{uuid}')
      expect(mockApiInstance.getPipeline.calledWith('ws', 'repo', '{uuid}')).to.be.true
    })
  })

  describe('triggerPipeline', () => {
    it('delegates with target', async () => {
      const target = {refName: 'main', refType: 'branch'}
      await triggerPipelineFn(mockConfig, 'ws', 'repo', target)
      expect(mockApiInstance.triggerPipeline.calledWith('ws', 'repo', target)).to.be.true
    })
  })
})
