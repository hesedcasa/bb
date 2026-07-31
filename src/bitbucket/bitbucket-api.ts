import {type ApiResult, type AuthConfig, buildAuthHeader} from '@hesed/plugin-lib'

/**
 * Bitbucket API Utility Module
 * Provides core Bitbucket REST API operations
 */
export class BitbucketApi {
  private config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * Approve a pull request
   */
  async approvePullRequest(workspace: string, repoSlug: string, pullRequestId: number): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/approve`, {
      method: 'POST',
    })
  }

  /**
   * Clear client (for cleanup)
   */
  clearClients(): void {
    // No persistent client to clear for REST API
  }

  /**
   * Create a pull request
   */
  // eslint-disable-next-line max-params
  async createPullRequest(
    workspace: string,
    repoSlug: string,
    title: string,
    sourceBranch: string,
    destinationBranch: string,
    description?: string,
    reviewers?: string[],
    autoAddReviewers = true,
  ): Promise<ApiResult> {
    let finalReviewers = reviewers

    if (autoAddReviewers) {
      const [currentUser, defaultReviewers] = await Promise.all([
        this.getCurrentUser(),
        this.getDefaultReviewers(workspace, repoSlug),
      ])

      if (currentUser.success && currentUser.data && defaultReviewers.length > 0) {
        const currentUserUuid = (currentUser.data as {uuid: string}).uuid
        const filteredReviewers = defaultReviewers.filter((reviewer) => reviewer.uuid !== currentUserUuid)
        finalReviewers = reviewers
          ? [...reviewers, ...filteredReviewers.map((r) => r.uuid)]
          : filteredReviewers.map((r) => r.uuid)
      }
    }

    const body: Record<string, unknown> = {
      destination: {branch: {name: destinationBranch}},
      source: {branch: {name: sourceBranch}},
      title,
    }

    if (description) {
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      body.description = description.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
    }

    if (finalReviewers && finalReviewers.length > 0) {
      body.reviewers = finalReviewers.map((uuid) => ({uuid}))
    }

    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests`, {
      body: JSON.stringify(body),
      method: 'POST',
    })
  }

  /**
   * Create a comment on a pull request, optionally inline on a specific file and line
   */
  // eslint-disable-next-line max-params
  async createPullRequestComment(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    content: string,
    inline?: {line: number; path: string},
  ): Promise<ApiResult> {
    const body: Record<string, unknown> = {content: {raw: content}}

    if (inline) {
      body.inline = {path: inline.path, to: inline.line}
    }

    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments`, {
      body: JSON.stringify(body),
      method: 'POST',
    })
  }

  /**
   * Create a repository
   */
  async createRepository(
    workspace: string,
    repoSlug: string,
    options?: {description?: string; isPrivate?: boolean; language?: string; projectKey?: string},
  ): Promise<ApiResult> {
    const body: Record<string, unknown> = {
      scm: 'git',
    }

    if (options?.description) body.description = options.description
    // eslint-disable-next-line camelcase
    if (options?.isPrivate !== undefined) body.is_private = options.isPrivate
    if (options?.language) body.language = options.language
    if (options?.projectKey) body.project = {key: options.projectKey}

    return this.request(`/repositories/${workspace}/${repoSlug}`, {
      body: JSON.stringify(body),
      method: 'PUT',
    })
  }

  /**
   * Decline a pull request
   */
  async declinePullRequest(workspace: string, repoSlug: string, pullRequestId: number): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/decline`, {
      method: 'POST',
    })
  }

  /**
   * Delete a comment on a pull request
   */
  async deletePullRequestComment(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    commentId: number,
  ): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments/${commentId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Delete a repository
   */
  async deleteRepository(workspace: string, repoSlug: string): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get a specific commit
   *
   * Uses the singular /commit/{sha} endpoint, which resolves commits that are no longer reachable
   * from any ref -- the state branch commits end up in after a squash merge with branch deletion.
   */
  async getCommit(workspace: string, repoSlug: string, commitSha: string): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/commit/${commitSha}`)
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<ApiResult> {
    return this.request('/user')
  }

  /**
   * Get default reviewers for a repository
   */
  async getDefaultReviewers(workspace: string, repoSlug: string): Promise<Array<{uuid: string}>> {
    const result = await this.request(`/repositories/${workspace}/${repoSlug}/effective-default-reviewers`)

    if (!result.success || !result.data) {
      return []
    }

    const response = result.data as {values?: Array<{user?: {uuid?: string}; uuid?: string}>}
    const reviewers = response.values || []
    return reviewers
      .map((reviewer) => ({
        uuid: reviewer.user?.uuid || reviewer.uuid || '',
      }))
      .filter((reviewer) => reviewer.uuid !== '')
  }

  /**
   * Get a specific pipeline
   */
  async getPipeline(workspace: string, repoSlug: string, pipelineUuid: string): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pipelines/${pipelineUuid}`)
  }

  /**
   * Get a specific pull request
   */
  async getPullRequest(workspace: string, repoSlug: string, pullRequestId: number): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}`)
  }

  /**
   * Get the diff for a pull request
   */
  async getPullRequestDiff(workspace: string, repoSlug: string, pullRequestId: number): Promise<ApiResult> {
    return this.requestText(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/diff`)
  }

  /**
   * Get repository details
   */
  async getRepository(workspace: string, repoSlug: string): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}`)
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspace: string): Promise<ApiResult> {
    return this.request(`/workspaces/${workspace}`)
  }

  /**
   * List commits for a repository, optionally restricted to a range
   *
   * `include` and `exclude` accept either a commit SHA or a branch name, and both may be repeated.
   * Passing one of each yields branch-only history (everything reachable from `include` but not from
   * `exclude`), which survives a squash merge and branch deletion.
   *
   * @param workspace - Workspace slug or UUID
   * @param repoSlug - Repository slug
   * @param page - Page number
   * @param pagelen - Number of items per page
   * @param include - Refs whose reachable commits are included
   * @param exclude - Refs whose reachable commits are excluded
   */
  // eslint-disable-next-line max-params
  async listCommits(
    workspace: string,
    repoSlug: string,
    page = 1,
    pagelen = 10,
    include?: string[],
    exclude?: string[],
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    // append, not set: the API accepts repeated include/exclude and each one must survive.
    for (const ref of include ?? []) params.append('include', ref)
    for (const ref of exclude ?? []) params.append('exclude', ref)

    return this.request(`/repositories/${workspace}/${repoSlug}/commits?${params.toString()}`)
  }

  /**
   * List pipelines for a repository
   */
  // eslint-disable-next-line max-params
  async listPipelines(workspace: string, repoSlug: string, page = 1, pagelen = 10, sort?: string): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    if (sort) params.set('sort', sort)

    return this.request(`/repositories/${workspace}/${repoSlug}/pipelines/?${params.toString()}`)
  }

  /**
   * List activity events on a pull request
   *
   * Each push emits an `update` event recording the new source tip, so the feed is the record of
   * every branch tip the pull request ever had.
   *
   * @param workspace - Workspace slug or UUID
   * @param repoSlug - Repository slug
   * @param pullRequestId - Pull request ID
   * @param page - Page number
   * @param pagelen - Number of items per page
   */
  // eslint-disable-next-line max-params
  async listPullRequestActivity(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    page = 1,
    pagelen = 10,
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/activity?${params.toString()}`,
    )
  }

  /**
   * List comments on a pull request
   */
  // eslint-disable-next-line max-params
  async listPullRequestComments(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    page = 1,
    pagelen = 10,
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments?${params.toString()}`,
    )
  }

  /**
   * List commits on a pull request
   *
   * Bitbucket only attributes commits to a pull request while its source branch still exists, so a
   * squash-merged pull request whose branch was deleted reports just the merge commit here.
   *
   * Unlike the repository-level /commits endpoint, this one pages by an *opaque* token rather than a
   * page number: a numeric `page=1` is rejected with "Invalid page". The token comes from the `page`
   * query parameter of the previous response's `next` link (e.g. `67Fg`), so `page` is a string here
   * and is omitted entirely for the first request.
   *
   * @param workspace - Workspace slug or UUID
   * @param repoSlug - Repository slug
   * @param pullRequestId - Pull request ID
   * @param pagelen - Number of items per page
   * @param page - Opaque page token from a previous response's `next` link
   */
  // eslint-disable-next-line max-params
  async listPullRequestCommits(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    pagelen = 10,
    page?: string,
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      pagelen: String(pagelen),
    })

    if (page) params.set('page', page)

    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/commits?${params.toString()}`,
    )
  }

  /**
   * List pull requests for a repository
   */
  // eslint-disable-next-line max-params
  async listPullRequests(
    workspace: string,
    repoSlug: string,
    state?: string,
    page = 1,
    pagelen = 10,
    q?: string,
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    if (state) params.set('state', state)
    if (q) params.set('q', q)

    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests?${params.toString()}`)
  }

  /**
   * List repositories for a workspace
   */
  // eslint-disable-next-line max-params
  async listRepositories(workspace: string, page = 1, pagelen = 10, role?: string, q?: string): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    if (role) params.set('role', role)
    if (q) params.set('q', q)

    return this.request(`/repositories/${workspace}?${params.toString()}`)
  }

  /**
   * List workspaces the authenticated user belongs to
   */
  async listWorkspaces(page = 1, pagelen = 10): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    return this.request(`/user/workspaces?${params.toString()}`)
  }

  /**
   * Merge a pull request
   */
  // eslint-disable-next-line max-params
  async mergePullRequest(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    mergeStrategy?: string,
    closeSrcBranch?: boolean,
    message?: string,
  ): Promise<ApiResult> {
    const body: Record<string, unknown> = {}

    // eslint-disable-next-line camelcase
    if (mergeStrategy) body.merge_strategy = mergeStrategy
    // eslint-disable-next-line camelcase
    if (closeSrcBranch !== undefined) body.close_source_branch = closeSrcBranch
    if (message) body.message = message

    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/merge`, {
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      method: 'POST',
    })
  }

  /**
   * Reply to a comment on a pull request
   */
  // eslint-disable-next-line max-params
  async replyToPullRequestComment(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    commentId: number,
    content: string,
  ): Promise<ApiResult> {
    const body = {
      content: {raw: content},
      parent: {id: commentId},
    }

    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments`, {
      body: JSON.stringify(body),
      method: 'POST',
    })
  }

  /**
   * Resolve a comment on a pull request
   */
  async resolvePullRequestComment(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    commentId: number,
  ): Promise<ApiResult> {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments/${commentId}/resolve`,
      {method: 'POST'},
    )
  }

  /**
   * Test Bitbucket API connection
   */
  async testConnection(): Promise<ApiResult> {
    return this.request('/user/workspaces')
  }

  /**
   * Trigger a pipeline
   */
  async triggerPipeline(
    workspace: string,
    repoSlug: string,
    target: {refName: string; refType: string; selector?: {pattern?: string; type?: string}},
  ): Promise<ApiResult> {
    const body: Record<string, unknown> = {
      target: {
        // eslint-disable-next-line camelcase
        ref_name: target.refName,
        // eslint-disable-next-line camelcase
        ref_type: target.refType,
        type: 'pipeline_ref_target',
      },
    }

    if (target.selector) {
      ;(body.target as Record<string, unknown>).selector = {
        pattern: target.selector.pattern,
        type: target.selector.type ?? 'custom',
      }
    }

    return this.request(`/repositories/${workspace}/${repoSlug}/pipelines/`, {
      body: JSON.stringify(body),
      method: 'POST',
    })
  }

  /**
   * Un-approve a pull request
   */
  async unapprovePullRequest(workspace: string, repoSlug: string, pullRequestId: number): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/approve`, {
      method: 'DELETE',
    })
  }

  /**
   * Update a pull request
   */
  async updatePullRequest(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    fields: Record<string, unknown>,
  ): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}`, {
      body: JSON.stringify(fields),
      method: 'PUT',
    })
  }

  /**
   * Update a comment on a pull request
   */
  // eslint-disable-next-line max-params
  async updatePullRequestComment(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    commentId: number,
    content: string,
  ): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/comments/${commentId}`, {
      body: JSON.stringify({content: {raw: content}}),
      method: 'PUT',
    })
  }

  /**
   * Build authorization header
   */
  private getAuthHeader(): string {
    return buildAuthHeader(this.config)
  }

  /**
   * Get the base URL for Bitbucket API
   */
  private getBaseUrl(): string {
    // Bitbucket Cloud API is always at api.bitbucket.org/2.0
    return 'https://api.bitbucket.org/2.0'
  }

  /**
   * Make an authenticated request to the Bitbucket API
   */
  private async request(path: string, options?: {body?: string; method?: string}): Promise<ApiResult> {
    try {
      const url = `${this.getBaseUrl()}${path}`
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: this.getAuthHeader(),
      }

      if (options?.body) {
        headers['Content-Type'] = 'application/json'
      }

      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- fetch is available in Node 18+
      const response = await fetch(url, {
        body: options?.body,
        headers,
        method: options?.method ?? 'GET',
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: unknown
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = errorText
        }

        return {
          error: errorData,
          success: false,
        }
      }

      // Some responses (204 No Content) may not have a body
      const text = await response.text()
      if (!text) {
        return {
          data: true,
          success: true,
        }
      }

      const data: unknown = JSON.parse(text)
      return {
        data,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Make an authenticated request expecting a plain text response
   */
  private async requestText(path: string): Promise<ApiResult> {
    try {
      const url = `${this.getBaseUrl()}${path}`
      const headers: Record<string, string> = {
        Accept: 'text/plain',
        Authorization: this.getAuthHeader(),
      }

      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- fetch is available in Node 18+
      const response = await fetch(url, {headers, method: 'GET'})

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: unknown
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = errorText
        }

        return {error: errorData, success: false}
      }

      const text = await response.text()
      return {data: text, success: true}
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {error: errorMessage, success: false}
    }
  }
}
