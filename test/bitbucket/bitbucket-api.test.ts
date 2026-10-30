import {expect} from 'chai'
import {Buffer} from 'node:buffer'
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
      fetchStub.resolves(Response.json({slug: 'test'}, {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers.Authorization).to.equal(`Basic ${expectedAuth}`)
    })

    it('sends Accept: application/json header', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers.Accept).to.equal('application/json')
    })

    it('uses hardcoded base URL', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.getRepository('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.match(/^https:\/\/api\.bitbucket\.org\/2\.0\//)
    })

    it('returns success with parsed JSON on 200 response', async () => {
      const responseData = {name: 'My Repo', slug: 'my-repo'}
      fetchStub.resolves(Response.json(responseData, {status: 200}))

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
      fetchStub.resolves(Response.json(errorBody, {status: 404}))

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
      fetchStub.resolves(Response.json({id: 1}, {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers['Content-Type']).to.equal('application/json')
    })

    it('does not set Content-Type when no body is present', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.getRepository('ws', 'repo')

      const [, options] = fetchStub.firstCall.args
      expect(options.headers['Content-Type']).to.be.undefined
    })
  })

  describe('testConnection', () => {
    it('calls GET /user/workspaces', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      const result = await api.testConnection()

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/user/workspaces')
      expect(options.method).to.equal('GET')
      expect(result.success).to.be.true
    })
  })

  describe('getWorkspace', () => {
    it('calls GET /workspaces/:workspace', async () => {
      fetchStub.resolves(Response.json({slug: 'my-ws'}, {status: 200}))

      await api.getWorkspace('my-ws')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/workspaces/my-ws')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listWorkspaces', () => {
    it('calls GET /workspaces with pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listWorkspaces(2, 25)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/workspaces?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=25')
    })

    it('uses default pagination', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listWorkspaces()

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=1')
      expect(url).to.include('pagelen=10')
    })
  })

  describe('getRepository', () => {
    it('calls GET /repositories/:workspace/:repoSlug', async () => {
      fetchStub.resolves(Response.json({slug: 'repo'}, {status: 200}))

      await api.getRepository('ws', 'repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listRepositories', () => {
    it('calls GET /repositories/:workspace with pagination', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listRepositories('ws', 2, 20)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=20')
    })

    it('includes role filter when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listRepositories('ws', 1, 10, 'admin')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('role=admin')
    })

    it('includes query filter when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listRepositories('ws', 1, 10, undefined, 'name~"test"')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('q=')
    })

    it('omits role and q when not provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listRepositories('ws')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('role=')
      expect(url).to.not.include('q=')
    })
  })

  describe('createRepository', () => {
    it('calls PUT /repositories/:workspace/:repoSlug', async () => {
      fetchStub.resolves(Response.json({slug: 'new-repo'}, {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/new-repo')
      expect(options.method).to.equal('PUT')
    })

    it('sends scm=git in body', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.createRepository('ws', 'new-repo')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.scm).to.equal('git')
    })

    it('includes optional fields when provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

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
      fetchStub.resolves(Response.json({}, {status: 200}))

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
      fetchStub.resolves(Response.json({id: 1}, {status: 200}))

      await api.getPullRequest('ws', 'repo', 1)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/1')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listPullRequests', () => {
    it('calls GET with pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequests('ws', 'repo', undefined, 2, 20)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pullrequests?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=20')
    })

    it('includes state filter when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequests('ws', 'repo', 'OPEN')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('state=OPEN')
    })

    it('omits state when not provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequests('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('state=')
    })
  })

  describe('getCommit', () => {
    it('calls GET /repositories/:workspace/:repoSlug/commit/:sha', async () => {
      fetchStub.resolves(Response.json({hash: 'abc123'}, {status: 200}))

      await api.getCommit('ws', 'repo', 'abc123')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/commit/abc123')
      expect(options.method).to.equal('GET')
    })

    it('returns the parsed commit on success', async () => {
      fetchStub.resolves(Response.json({author: {raw: 'A <a@b.c>'}, hash: 'abc123'}, {status: 200}))

      const result = await api.getCommit('ws', 'repo', 'abc123')

      expect(result.success).to.be.true
      expect(result.data).to.deep.equal({author: {raw: 'A <a@b.c>'}, hash: 'abc123'})
    })

    it('reports failure without throwing when the commit is missing', async () => {
      fetchStub.resolves(Response.json({error: {message: 'Commit not found'}}, {status: 404}))

      const result = await api.getCommit('ws', 'repo', 'nope')

      expect(result.success).to.be.false
      expect(result.error).to.deep.equal({error: {message: 'Commit not found'}})
    })
  })

  describe('listCommits', () => {
    it('calls GET with pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listCommits('ws', 'repo', 2, 20)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/commits?')
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=20')
    })

    it('omits include and exclude when not provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listCommits('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('include=')
      expect(url).to.not.include('exclude=')
    })

    it('includes a single include/exclude pair when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listCommits('ws', 'repo', 1, 10, ['feature-x'], ['master'])

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('include=feature-x')
      expect(url).to.include('exclude=master')
    })

    it('preserves every repeated include and exclude ref', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listCommits('ws', 'repo', 1, 10, ['aaa111', 'bbb222'], ['ccc333', 'ddd444'])

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('include=aaa111')
      expect(url).to.include('include=bbb222')
      expect(url).to.include('exclude=ccc333')
      expect(url).to.include('exclude=ddd444')
    })
  })

  describe('listPullRequestCommits', () => {
    it('calls GET /pullrequests/:id/commits with pagelen', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestCommits('ws', 'repo', 42, 25)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pullrequests/42/commits?')
      expect(url).to.include('pagelen=25')
    })

    // The endpoint rejects a numeric page with "Invalid page", so the first request must send none.
    it('omits page entirely when no token is provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestCommits('ws', 'repo', 42)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('pagelen=10')
      expect(url).to.not.include('page=')
    })

    it('passes an opaque page token through unchanged', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestCommits('ws', 'repo', 42, 10, '67Fg')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=67Fg')
    })
  })

  describe('listPullRequestActivity', () => {
    it('calls GET /pullrequests/:id/activity with pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestActivity('ws', 'repo', 42, 3, 50)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pullrequests/42/activity?')
      expect(url).to.include('page=3')
      expect(url).to.include('pagelen=50')
    })

    it('defaults pagination when not provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestActivity('ws', 'repo', 42)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=1')
      expect(url).to.include('pagelen=10')
    })
  })

  describe('createPullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'My PR', 'feature', 'main', undefined, undefined, false)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests')
      expect(options.method).to.equal('POST')
    })

    it('sends correct body with required fields', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'My PR', 'feature', 'main', undefined, undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.title).to.equal('My PR')
      expect(body.source.branch.name).to.equal('feature')
      expect(body.destination.branch.name).to.equal('main')
    })

    it('includes description when provided', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', 'A description', undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.equal('A description')
    })

    it('omits description when not provided', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, undefined, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.description).to.be.undefined
    })

    it('includes reviewers when provided', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, ['{uuid-1}', '{uuid-2}'], false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.reviewers).to.deep.equal([{uuid: '{uuid-1}'}, {uuid: '{uuid-2}'}])
    })

    it('omits reviewers when empty array', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, [], false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.reviewers).to.be.undefined
    })

    it('sets draft: true when requested', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, undefined, false, true)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.draft).to.be.true
    })

    it('omits draft when not requested', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 201}))

      await api.createPullRequest('ws', 'repo', 'PR', 'feat', 'main', undefined, undefined, false, false)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.draft).to.be.undefined
    })
  })

  describe('updatePullRequest', () => {
    it('calls PUT /repositories/:workspace/:repoSlug/pullrequests/:id', async () => {
      fetchStub.resolves(Response.json({id: 1}, {status: 200}))

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
      fetchStub.resolves(Response.json({id: 1}, {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/1/merge')
      expect(options.method).to.equal('POST')
    })

    it('sends empty body when no options provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1)

      const [, options] = fetchStub.firstCall.args
      expect(options.body).to.be.undefined
    })

    it('includes merge_strategy when provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, 'squash')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.merge_strategy).to.equal('squash')
    })

    it('includes close_source_branch when provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, undefined, true)

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.close_source_branch).to.be.true
    })

    it('includes message when provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.mergePullRequest('ws', 'repo', 1, undefined, undefined, 'Merge commit msg')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.message).to.equal('Merge commit msg')
    })
  })

  describe('approvePullRequest', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/approve', async () => {
      fetchStub.resolves(Response.json({approved: true}, {status: 200}))

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
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.declinePullRequest('ws', 'repo', 5)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/5/decline')
      expect(options.method).to.equal('POST')
    })
  })

  describe('createPullRequestComment', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/comments', async () => {
      fetchStub.resolves(Response.json({id: 10}, {status: 201}))

      await api.createPullRequestComment('ws', 'repo', 42, 'Looks good')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments')
      expect(options.method).to.equal('POST')
    })

    it('sends content.raw in body', async () => {
      fetchStub.resolves(Response.json({id: 10}, {status: 201}))

      await api.createPullRequestComment('ws', 'repo', 42, 'Looks good')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.content.raw).to.equal('Looks good')
    })

    it('includes inline when path and line are provided', async () => {
      fetchStub.resolves(Response.json({id: 10}, {status: 201}))

      await api.createPullRequestComment('ws', 'repo', 42, 'Fix this', {line: 15, path: 'src/foo.ts'})

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.inline).to.deep.equal({path: 'src/foo.ts', to: 15})
    })

    it('omits inline when not provided', async () => {
      fetchStub.resolves(Response.json({id: 10}, {status: 201}))

      await api.createPullRequestComment('ws', 'repo', 42, 'General comment')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.inline).to.be.undefined
    })
  })

  describe('listPullRequestComments', () => {
    it('calls GET /repositories/:workspace/:repoSlug/pullrequests/:id/comments', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestComments('ws', 'repo', 42)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments')
    })

    it('includes pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestComments('ws', 'repo', 42, 2, 25)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=2')
      expect(url).to.include('pagelen=25')
    })

    it('uses default pagination when not specified', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPullRequestComments('ws', 'repo', 42)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('page=1')
      expect(url).to.include('pagelen=10')
    })
  })

  describe('deletePullRequestComment', () => {
    it('calls DELETE /repositories/:workspace/:repoSlug/pullrequests/:id/comments/:commentId', async () => {
      fetchStub.resolves(new Response('', {status: 200}))

      await api.deletePullRequestComment('ws', 'repo', 42, 100)

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments/100')
      expect(options.method).to.equal('DELETE')
    })
  })

  describe('updatePullRequestComment', () => {
    it('calls PUT /repositories/:workspace/:repoSlug/pullrequests/:id/comments/:commentId', async () => {
      fetchStub.resolves(Response.json({id: 100}, {status: 200}))

      await api.updatePullRequestComment('ws', 'repo', 42, 100, 'Updated text')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments/100')
      expect(options.method).to.equal('PUT')
    })

    it('sends content.raw in body', async () => {
      fetchStub.resolves(Response.json({id: 100}, {status: 200}))

      await api.updatePullRequestComment('ws', 'repo', 42, 100, 'Updated text')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.content.raw).to.equal('Updated text')
    })
  })

  describe('replyToPullRequestComment', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pullrequests/:id/comments', async () => {
      fetchStub.resolves(Response.json({id: 200}, {status: 201}))

      await api.replyToPullRequestComment('ws', 'repo', 42, 100, 'Thanks!')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments')
      expect(options.method).to.equal('POST')
    })

    it('sends content.raw and parent.id in body', async () => {
      fetchStub.resolves(Response.json({id: 200}, {status: 201}))

      await api.replyToPullRequestComment('ws', 'repo', 42, 100, 'Thanks!')

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.content.raw).to.equal('Thanks!')
      expect(body.parent.id).to.equal(100)
    })
  })

  describe('getPipeline', () => {
    it('calls GET /repositories/:workspace/:repoSlug/pipelines/:uuid', async () => {
      fetchStub.resolves(Response.json({uuid: '{pipe-1}'}, {status: 200}))

      await api.getPipeline('ws', 'repo', '{pipe-1}')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pipelines/{pipe-1}')
      expect(options.method).to.equal('GET')
    })
  })

  describe('listPipelines', () => {
    it('calls GET with pagination params', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPipelines('ws', 'repo', 3, 15)

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('/repositories/ws/repo/pipelines/?')
      expect(url).to.include('page=3')
      expect(url).to.include('pagelen=15')
    })

    it('includes sort when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPipelines('ws', 'repo', 1, 10, '-created_on')

      const [url] = fetchStub.firstCall.args
      expect(url).to.include('sort=-created_on')
    })

    it('omits sort when not provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listPipelines('ws', 'repo')

      const [url] = fetchStub.firstCall.args
      expect(url).to.not.include('sort=')
    })
  })

  describe('getBranch', () => {
    it('calls GET /repositories/:workspace/:repoSlug/refs/branches/:branch', async () => {
      fetchStub.resolves(Response.json({name: 'main'}, {status: 200}))

      await api.getBranch('ws', 'repo', 'main')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/main')
      expect(options.method).to.equal('GET')
    })

    it('returns the ref payload unchanged', async () => {
      const ref = {name: 'main', target: {hash: 'abc123'}}
      fetchStub.resolves(Response.json(ref, {status: 200}))

      const result = await api.getBranch('ws', 'repo', 'main')

      expect(result.success).to.be.true
      expect(result.data).to.deep.equal(ref)
    })

    it('encodes a slash in the branch name exactly once', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 200}))

      await api.getBranch('ws', 'repo', 'feature/x')

      const [url] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/feature%2Fx')
    })

    it('encodes spaces, percent, question mark and hash in the branch name', async () => {
      fetchStub.resolves(Response.json({}, {status: 200}))

      await api.getBranch('ws', 'repo', 'feature branch')
      expect(fetchStub.firstCall.args[0]).to.equal(
        'https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/feature%20branch',
      )

      await api.getBranch('ws', 'repo', '50%off')
      expect(fetchStub.secondCall.args[0]).to.equal(
        'https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/50%25off',
      )

      await api.getBranch('ws', 'repo', 'bug?fix')
      expect(fetchStub.thirdCall.args[0]).to.equal(
        'https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/bug%3Ffix',
      )

      await api.getBranch('ws', 'repo', 'c#7')
      expect(fetchStub.lastCall.args[0]).to.equal(
        'https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches/c%237',
      )
    })

    it('reports failure without throwing when the branch is missing', async () => {
      fetchStub.resolves(Response.json({error: {message: 'Not found'}}, {status: 404}))

      const result = await api.getBranch('ws', 'repo', 'nope')

      expect(result.success).to.be.false
      expect(result.error).to.deep.equal({error: {message: 'Not found'}})
    })
  })

  describe('listBranches', () => {
    it('calls GET /repositories/:workspace/:repoSlug/refs/branches with default pagination', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listBranches('ws', 'repo')

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches?page=1&pagelen=10')
      expect(options.method).to.equal('GET')
    })

    it('passes explicit page and pagelen through', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listBranches('ws', 'repo', {page: 3, pagelen: 25})

      const [url] = fetchStub.firstCall.args
      const params = new URL(url).searchParams
      expect(params.get('page')).to.equal('3')
      expect(params.get('pagelen')).to.equal('25')
    })

    it('includes q when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listBranches('ws', 'repo', {q: 'name ~ "feature/x"'})

      const [url] = fetchStub.firstCall.args
      const params = new URL(url).searchParams
      expect(params.get('q')).to.equal('name ~ "feature/x"')
      expect(params.get('sort')).to.be.null
    })

    it('includes sort when provided', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listBranches('ws', 'repo', {sort: '-name'})

      const [url] = fetchStub.firstCall.args
      const params = new URL(url).searchParams
      expect(params.get('sort')).to.equal('-name')
      expect(params.get('q')).to.be.null
    })

    it('includes q and sort together', async () => {
      fetchStub.resolves(Response.json({values: []}, {status: 200}))

      await api.listBranches('ws', 'repo', {page: 2, pagelen: 5, q: 'name ~ "e2e"', sort: 'name'})

      const [url] = fetchStub.firstCall.args
      const params = new URL(url).searchParams
      expect(params.get('page')).to.equal('2')
      expect(params.get('pagelen')).to.equal('5')
      expect(params.get('q')).to.equal('name ~ "e2e"')
      expect(params.get('sort')).to.equal('name')
    })

    it('returns the collection page unchanged, pagination metadata included', async () => {
      const page = {next: 'https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches?page=2', page: 1, pagelen: 10, values: [{name: 'main'}]}
      fetchStub.resolves(Response.json(page, {status: 200}))

      const result = await api.listBranches('ws', 'repo')

      expect(result.success).to.be.true
      expect(result.data).to.deep.equal(page)
    })

    it('reports failure without throwing on an HTTP error', async () => {
      fetchStub.resolves(Response.json({error: {message: 'Repository not found'}}, {status: 404}))

      const result = await api.listBranches('ws', 'repo')

      expect(result.success).to.be.false
      expect(result.error).to.deep.equal({error: {message: 'Repository not found'}})
    })

    it('reports network failures as failed results', async () => {
      fetchStub.rejects(new Error('Network timeout'))

      const result = await api.listBranches('ws', 'repo')

      expect(result.success).to.be.false
      expect(result.error).to.equal('Network timeout')
    })
  })

  describe('createBranch', () => {
    it('calls POST /repositories/:workspace/:repoSlug/refs/branches', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 201}))

      await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/refs/branches')
      expect(options.method).to.equal('POST')
    })

    it('sends a JSON content type', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 201}))

      await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      const [, options] = fetchStub.firstCall.args
      expect(options.headers['Content-Type']).to.equal('application/json')
    })

    it('sends the exact name/target body', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 201}))

      await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      const [, options] = fetchStub.firstCall.args
      expect(JSON.parse(options.body)).to.deep.equal({name: 'feature/x', target: {hash: 'abc123'}})
    })

    it('keeps a slash-containing branch name literal in the JSON body', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 201}))

      await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      const [, options] = fetchStub.firstCall.args
      expect(options.body).to.equal('{"name":"feature/x","target":{"hash":"abc123"}}')
      expect(options.body).to.not.include('%2F')
    })

    it('succeeds on both 200 and 201 responses', async () => {
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 200}))
      const updated = await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})
      expect(updated.success).to.be.true

      fetchStub.resetHistory()
      fetchStub.resolves(Response.json({name: 'feature/x'}, {status: 201}))
      const created = await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})
      expect(created.success).to.be.true
    })

    it('reports rejection without throwing', async () => {
      fetchStub.resolves(Response.json({error: {message: 'You are not permitted'}}, {status: 403}))

      const result = await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      expect(result.success).to.be.false
      expect(result.error).to.deep.equal({error: {message: 'You are not permitted'}})
    })

    it('reports network failures as failed results', async () => {
      fetchStub.rejects(new Error('Network timeout'))

      const result = await api.createBranch('ws', 'repo', {name: 'feature/x', targetHash: 'abc123'})

      expect(result.success).to.be.false
      expect(result.error).to.equal('Network timeout')
    })
  })

  describe('triggerPipeline', () => {
    it('calls POST /repositories/:workspace/:repoSlug/pipelines/', async () => {
      fetchStub.resolves(Response.json({uuid: '{new}'}, {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://api.bitbucket.org/2.0/repositories/ws/repo/pipelines/')
      expect(options.method).to.equal('POST')
    })

    it('sends correct target body', async () => {
      fetchStub.resolves(Response.json({}, {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.ref_name).to.equal('main')
      expect(body.target.ref_type).to.equal('branch')
      expect(body.target.type).to.equal('pipeline_ref_target')
    })

    it('includes selector when provided', async () => {
      fetchStub.resolves(Response.json({}, {status: 201}))

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
      fetchStub.resolves(Response.json({}, {status: 201}))

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
      fetchStub.resolves(Response.json({}, {status: 201}))

      await api.triggerPipeline('ws', 'repo', {refName: 'main', refType: 'branch'})

      const [, options] = fetchStub.firstCall.args
      const body = JSON.parse(options.body)
      expect(body.target.selector).to.be.undefined
    })
  })
})
