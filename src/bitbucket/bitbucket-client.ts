import type {ApiResult, Config} from './bitbucket-api.js'

import {BitbucketApi} from './bitbucket-api.js'

let bitbucketApi: BitbucketApi | null

/**
 * Initialize Bitbucket API
 */
async function initBitbucket(config: Config): Promise<BitbucketApi> {
  if (bitbucketApi) return bitbucketApi

  try {
    bitbucketApi = new BitbucketApi(config)
    return bitbucketApi
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to initialize Bitbucket client: ${errorMessage}`)
  }
}

/**
 * Clear clients (for cleanup)
 */
export function clearClients(): void {
  bitbucketApi = null
}

/**
 * Test Bitbucket API connection
 * @param config - Bitbucket configuration
 */
export async function testConnection(config: Config): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.testConnection()
}

/**
 * List workspaces
 * @param config - Bitbucket configuration
 * @param page - Page number
 * @param pagelen - Number of items per page
 */
export async function listWorkspaces(config: Config, page = 1, pagelen = 10): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.listWorkspaces(page, pagelen)
}

/**
 * Get workspace details
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 */
export async function getWorkspace(config: Config, workspace: string): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.getWorkspace(workspace)
}

/**
 * List repositories for a workspace
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param page - Page number
 * @param pagelen - Number of items per page
 * @param role - Filter by the role of the authenticated user
 * @param q - Query string to filter repositories
 */
// eslint-disable-next-line max-params
export async function listRepositories(
  config: Config,
  workspace: string,
  page = 1,
  pagelen = 10,
  role?: string,
  q?: string,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.listRepositories(workspace, page, pagelen, role, q)
}

/**
 * Get repository details
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 */
export async function getRepository(config: Config, workspace: string, repoSlug: string): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.getRepository(workspace, repoSlug)
}

/**
 * Create a repository
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param options - Repository options
 * @param options.description - Repository description
 * @param options.isPrivate - Whether the repository is private
 * @param options.language - Repository language
 * @param options.projectKey - Project key to associate the repository with
 */
export async function createRepository(
  config: Config,
  workspace: string,
  repoSlug: string,
  options?: {description?: string; isPrivate?: boolean; language?: string; projectKey?: string},
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.createRepository(workspace, repoSlug, options)
}

/**
 * Delete a repository
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 */
export async function deleteRepository(config: Config, workspace: string, repoSlug: string): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.deleteRepository(workspace, repoSlug)
}

/**
 * List pull requests for a repository
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param state - Filter by state (OPEN, MERGED, DECLINED, SUPERSEDED)
 * @param page - Page number
 * @param pagelen - Number of items per page
 */
// eslint-disable-next-line max-params
export async function listPullRequests(
  config: Config,
  workspace: string,
  repoSlug: string,
  state?: string,
  page = 1,
  pagelen = 10,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.listPullRequests(workspace, repoSlug, state, page, pagelen)
}

/**
 * Get a specific pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 */
export async function getPullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.getPullRequest(workspace, repoSlug, pullRequestId)
}

/**
 * Create a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param title - Pull request title
 * @param sourceBranch - Source branch name
 * @param destinationBranch - Destination branch name
 * @param description - Pull request description
 * @param reviewers - List of reviewer UUIDs
 * @param autoAddReviewers - Automatically add default reviewers from repository settings
 */
// eslint-disable-next-line max-params
export async function createPullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  title: string,
  sourceBranch: string,
  destinationBranch: string,
  description?: string,
  reviewers?: string[],
  autoAddReviewers = true,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.createPullRequest(
    workspace,
    repoSlug,
    title,
    sourceBranch,
    destinationBranch,
    description,
    reviewers,
    autoAddReviewers,
  )
}

/**
 * Update a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 * @param fields - Fields to update
 */
// eslint-disable-next-line max-params
export async function updatePullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  fields: Record<string, unknown>,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.updatePullRequest(workspace, repoSlug, pullRequestId, fields)
}

/**
 * Merge a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 * @param mergeStrategy - Merge strategy (merge_commit, squash, fast_forward)
 * @param closeSrcBranch - Close source branch on merge
 * @param message - Merge commit message
 */
// eslint-disable-next-line max-params
export async function mergePullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  mergeStrategy?: string,
  closeSrcBranch?: boolean,
  message?: string,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.mergePullRequest(workspace, repoSlug, pullRequestId, mergeStrategy, closeSrcBranch, message)
}

/**
 * Decline a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 */
export async function declinePullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.declinePullRequest(workspace, repoSlug, pullRequestId)
}

/**
 * Approve a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 */
export async function approvePullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.approvePullRequest(workspace, repoSlug, pullRequestId)
}

/**
 * Get the diff for a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 */
export async function getPullRequestDiff(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.getPullRequestDiff(workspace, repoSlug, pullRequestId)
}

/**
 * Un-approve a pull request
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pullRequestId - Pull request ID
 */
export async function unapprovePullRequest(
  config: Config,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.unapprovePullRequest(workspace, repoSlug, pullRequestId)
}

/**
 * List pipelines for a repository
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param page - Page number
 * @param pagelen - Number of items per page
 * @param sort - Sort field
 */
// eslint-disable-next-line max-params
export async function listPipelines(
  config: Config,
  workspace: string,
  repoSlug: string,
  page = 1,
  pagelen = 10,
  sort?: string,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.listPipelines(workspace, repoSlug, page, pagelen, sort)
}

/**
 * Get a specific pipeline
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param pipelineUuid - Pipeline UUID
 */
export async function getPipeline(
  config: Config,
  workspace: string,
  repoSlug: string,
  pipelineUuid: string,
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.getPipeline(workspace, repoSlug, pipelineUuid)
}

/**
 * Trigger a pipeline
 * @param config - Bitbucket configuration
 * @param workspace - Workspace slug or UUID
 * @param repoSlug - Repository slug
 * @param target - Pipeline target configuration
 * @param target.refName - Branch or tag name
 * @param target.refType - Type of ref (branch, tag, etc.)
 * @param target.selector - Selector for custom pipelines
 * @param target.selector.pattern - Pattern to match pipeline
 * @param target.selector.type - Type of selector
 */
export async function triggerPipeline(
  config: Config,
  workspace: string,
  repoSlug: string,
  target: {refName: string; refType: string; selector?: {pattern?: string; type?: string}},
): Promise<ApiResult> {
  const bb = await initBitbucket(config)
  return bb.triggerPipeline(workspace, repoSlug, target)
}
