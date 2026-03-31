/**
 * Generic API result
 */
export interface ApiResult {
  data?: unknown
  error?: unknown
  success: boolean
}

export interface Config {
  apiToken: string
  email: string
  host: string
}

/**
 * Bitbucket API Utility Module
 * Provides core Bitbucket REST API operations
 */
export class BitbucketApi {
  private config: Config

  constructor(config: Config) {
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
   * Delete a repository
   */
  async deleteRepository(workspace: string, repoSlug: string): Promise<ApiResult> {
    return this.request(`/repositories/${workspace}/${repoSlug}`, {
      method: 'DELETE',
    })
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
   * List pull requests for a repository
   */
  // eslint-disable-next-line max-params
  async listPullRequests(
    workspace: string,
    repoSlug: string,
    state?: string,
    page = 1,
    pagelen = 10,
  ): Promise<ApiResult> {
    const params = new URLSearchParams({
      page: String(page),
      pagelen: String(pagelen),
    })

    if (state) params.set('state', state)

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

    return this.request(`/workspaces?${params.toString()}`)
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
   * Test Bitbucket API connection
   */
  async testConnection(): Promise<ApiResult> {
    return this.request('/user')
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
   * Build authorization header
   */
  private getAuthHeader(): string {
    const authString = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')
    return `Basic ${authString}`
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
