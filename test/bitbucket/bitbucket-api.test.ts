/* eslint-disable n/no-unsupported-features/node-builtins */
import {expect} from 'chai'
import {type SinonStub, stub} from 'sinon'

import {BitbucketApi} from '../../src/bitbucket/bitbucket-api.js'

describe('BitbucketApi', () => {
  const config = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }
  let api: BitbucketApi
  let fetchStub: SinonStub

  beforeEach(() => {
    api = new BitbucketApi(config)
    fetchStub = stub(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchStub.restore()
  })

  it('creates an instance with config', () => {
    expect(api).to.be.instanceOf(BitbucketApi)
  })

  it('clearClients does not throw', () => {
    expect(() => api.clearClients()).to.not.throw()
  })

  describe('request internals', () => {
    it('sends correct authorization header', async () => {
      const expectedAuth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
      fetchStub.resolves(new Response(JSON.stringify({slug: 'test'}), {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers.Authorization).to.equal(`Basic ${expectedAuth}`)
    })

    it('sends Accept: application/json header', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers.Accept).to.equal('application/json')
    })

    it('uses hardcoded base URL', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.getRepository('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.match(/^https:\/\/api\.bitbucket\.org\/2\.0\//)
    })

    it('returns success with parsed JSON on 200 response', async () => {
      const responseData = {name: 'My Repo', slug: 'my-repo'}
      fetchStub.resolves(new Response(JSON.stringify(responseData), {status: 200}))

      const result = await api.getRepository('ws', 'my-repo')

      expect(result.success).to.be.true
      expect(result.data).to.deep.equal(responseData)
      expect(result.error).to.be.undefined
    })

    it('returns success with data=true on 204 No Content', async () => {
      fetchStub.resolves({
        ok: true,
        status: 204,
        text: async () => '',
      })

      const result = await api.deleteRepository('ws', 'repo')

      expect(result.success).to.be.true
      expect(result.data).to.equal(true)
    })

    it('returns error with parsed JSON on non-OK response with JSON body', async () => {
      const errorBody = {error: {message: 'Not Found'}}
      fetchStub.resolves(new Response(JSON.stringify(errorBody), {status: 404}))

      const result = await api.getRepository('ws', 'nonexistent')

      expect(result.success).to.be.false
      expect(result.data).to.be.undefined
      expect(result.error).to.deep.equal(errorBody)
    })

    it('returns error with raw text on non-OK response with non-JSON body', async () => {
      fetchStub.resolves(new Response('Service Unavailable', {status: 503}))

      const result = await api.getRepository('ws', 'repo')

      expect(result.success).to.be.false
      expect(result.error).to.equal('Service Unavailable')
    })

    it('returns error on network exception', async () => {
      fetchStub.rejects(new Error('Network timeout'))

      const result = await api.getRepository('ws', 'repo')

      expect(result.success).to.be.false
      expect(result.error).to.equal('Network timeout')
    })

    it('returns error on non-Error exception', async () => {
      fetchStub.rejects('string error')

      const result = await api.getRepository('ws', 'repo')

      expect(result.success).to.be.false
      expect(result.error).to.be.a('string')
    })

    it('sets Content-Type when body is present', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers['Content-Type']).to.equal('application/json')
    })

    it('does not set Content-Type when no body is present', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers['Content-Type']).to.be.undefined
    })
  })

  describe('testConnection', () => {
    it('calls GET /user', async () => {
      fetchStub.resolves(new Response(JSON.stringify({username: 'testuser'}), {status: 200}))

      const result = await api.testConnection()

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/user')
      expect(options.method).to.equal('GET')
      expect(result.success).to.be.true
    })
  })

  describe('getWorkspace', () => {
    it('calls GET /workspaces/:workspace', async () => {
      fetchStub.resolves(new Response(JSON.stringify({slug: 'my-ws'}), {status: 200}))

      await api.getWorkspace('my-ws')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/workspaces/my-ws')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listWorkspaces', () => {
    it('calls GET /workspaces with pagination params', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listWorkspaces(2, 25)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/workspaces?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=25')
    })

    it('uses default pagination', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listWorkspaces()

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=1')
      expect(url).to.include('pagelen=10')
    })
  })

  describe('getRepository', () => {
    it('calls GET /repositories/:workspace/:repoSlug', async () => {
      fetchStub.resolves(new Response(JSON.stringify({slug: 'repo'}), {status: 200}))

      await api.getRepository('ws', 'repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listRepositories', () => {
    it('calls GET /repositories/:workspace with pagination', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listRepositories('ws', 2, 20)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=20')
    })

    it('includes role filter when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listRepositories('ws', 1, 10, 'admin')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('role=admin')
    })

    it('includes query filter when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listRepositories('ws', 1, 10, undefined, 'name~"test"')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('q=')
    })

    it('omits role and q when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listRepositories('ws')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('role=')
      expect(url).to.not.include('q=')
    })
  })

  describe('createRepository', () => {
    it('calls PUT /repositories/:workspace/:repoSlug', async () => {
      fetchStub.resolves(new Response(JSON.stringify({slug: 'new-repo'}), {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/new-repo')
      expect(options.method).to.equal('PUT')
    })

    it('sends scm=git in body', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.scm).to.equal('git')
    })

    it('includes optional fields when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.createRepository('ws', 'new-repo', {
        description: 'My repo',
        isPrivate: true,
        language: 'typescript',
        projectKey: 'PROJ',
      })

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.equal('My repo')
      expect(body.is_private).to.be.true
      expect(body.language).to.equal('typescript')
      expect(body.project).to.deep.equal({key: 'PROJ'})
    })

    it('omits optional fields when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.be.undefined
      expect(body.is_private).to.be.undefined
      expect(body.language).to.be.undefined
      expect(body.project).to.be.undefined
    })
  })

  describe('deleteRepository', () => {
    it('calls DELETE /repositories/:workspace/:repoSlug', async () => {
      fetchStub.resolves({
        ok: true,
        status: 204,
        text: async () => '',
      })

      await api.deleteRepository('ws', 'repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo')
      expect(options.method).to.equal('DELETE')
    })
  })

  describe('getPullRequest', () => {
    it('calls GET /repositories/:workspace/:repoSlug/pullrequests/:id', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 200}))

      await api.getPullRequest('ws', 'repo', 1)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/1')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listPullRequests', () => {
    it('calls GET with pagination params', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPullRequests('ws', 'repo', undefined, 2, 20)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pullrequests?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=20')
    })

    it('includes state filter when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPullRequests('ws', 'repo', 'OPEN')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('state=OPEN')
    })

    it('omits state when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPullRequests('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('state=')
    })
  })

  describe('createPullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'My PR', 'feature', 'main', undefined, undefined, false)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests')
      expect(options.method).to.equal('POST')
    })

    it('sends correct body with required fields', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'My PR', 'feature', 'main', undefined, undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.title).to.equal('My PR')
      expect(body.source.branch.name).to.equal('feature')
      expect(body.destination.branch.name).to.equal('main')
    })

    it('includes description when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', 'A description', undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.equal('A description')
    })

    it('omits description when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.be.undefined
    })

    it('includes reviewers when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, ['{uuid-1}', '{uuid-2}'], false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.reviewers).to.deep.equal([{uuid: '{uuid-1}'}, {uuid: '{uuid-2}'}])
    })

    it('omits reviewers when empty array', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, [], false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.reviewers).to.be.undefined
    })
  })

  describe('updatePullRequest', () => {
    it('calls PUT /repositories/:workspace/:repoSlug/pullrequests/:id', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 200}))

      await api.updatePullRequest('ws', 'repo', 1, {title: 'Updated'})

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/1')
      expect(options.method).to.equal('PUT')
      const body = JSON.parse(options.body)
      expect(body.title).to.equal('Updated')
    })
  })

  describe('mergePullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/merge', async () => {
      fetchStub.resolves(new Response(JSON.stringify({id: 1}), {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/1/merge')
      expect(options.method).to.equal('POST')
    })

    it('sends empty body when no options provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1)

      const [, options] = fetchStub.firstCall.args
      expect(options.body).to.be.undefined
    })

    it('includes merge_strategy when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, 'squash')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.merge_strategy).to.equal('squash')
    })

    it('includes close_source_branch when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, undefined, true)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.close_source_branch).to.be.true
    })

    it('includes message when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, undefined, undefined, 'Merge commit msg')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.message).to.equal('Merge commit msg')
    })
  })

  describe('approvePullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/approve', async () => {
      fetchStub.resolves(new Response(JSON.stringify({approved: true}), {status: 200}))

      await api.approvePullRequest('ws', 'repo', 42)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/approve')
      expect(options.method).to.equal('POST')
    })
  })

  describe('unapprovePullRequest', () => {
    it('calls DELETE /repositories/:workspace/:repoSlug/pullrequests/:id/approve', async () => {
      fetchStub.resolves({
        ok: true,
        status: 204,
        text: async () => '',
      })

      await api.unapprovePullRequest('ws', 'repo', 42)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/approve')
      expect(options.method).to.equal('DELETE')
    })
  })

  describe('declinePullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/decline', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 200}))

      await api.declinePullRequest('ws', 'repo', 5)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/5/decline')
      expect(options.method).to.equal('POST')
    })
  })

  describe('getPipeline', () => {
    it('calls GET /repositories/:workspace/:repoSlug/pipelines/:uuid', async () => {
      fetchStub.resolves(new Response(JSON.stringify({uuid: '{pipe-1}'}), {status: 200}))

      await api.getPipeline('ws', 'repo', '{pipe-1}')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pipelines/{pipe-1}')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listPipelines', () => {
    it('calls GET with pagination params', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPipelines('ws', 'repo', 3, 15)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pipelines/?')
      expect(url).to.include('page=3')
      expect(url).to.include('pagelen=15')
    })

    it('includes sort when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPipelines('ws', 'repo', 1, 10, '-created_on')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('sort=-created_on')
    })

    it('omits sort when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({values: []}), {status: 200}))

      await api.listPipelines('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('sort=')
    })
  })

  describe('triggerPipeline', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pipelines/', async () => {
      fetchStub.resolves(new Response(JSON.stringify({uuid: '{new}'}), {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pipelines/')
      expect(options.method).to.equal('POST')
    })

    it('sends correct target body', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.ref_name).to.equal('main')
      expect(body.target.ref_type).to.equal('branch')
      expect(body.target.type).to.equal('pipeline_ref_target')
    })

    it('includes selector when provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 201}))

      await api.triggerPipeline('ws', 'repo', {
        refName: 'main',
        refType: 'branch',
        selector: {pattern: 'my-pipeline', type: 'custom'},
      })

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.selector).to.deep.equal({pattern: 'my-pipeline', type: 'custom'})
    })

    it('defaults selector type to custom', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 201}))

      await api.triggerPipeline('ws', 'repo', {
        refName: 'main',
        refType: 'branch',
        selector: {pattern: 'deploy'},
      })

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.selector.type).to.equal('custom')
    })

    it('omits selector when not provided', async () => {
      fetchStub.resolves(new Response(JSON.stringify({}), {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.selector).to.be.undefined
    })
  })
})
