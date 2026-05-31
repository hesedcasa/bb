import {type ApiResult, type AuthConfig, createApiClient} from '@hesed/plugin-lib'

import {BitbucketApi} from './bitbucket-api.js'

const {clearClients, getClient} = createApiClient('Bitbucket', (config: AuthConfig) => new BitbucketApi(config))

export {clearClients}

export async function testConnection(config: AuthConfig): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.testConnection()
}

export async function listWorkspaces(config: AuthConfig, page = 1, pagelen = 10): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.listWorkspaces(page, pagelen)
}

export async function getWorkspace(config: AuthConfig, workspace: string): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.getWorkspace(workspace)
}

// eslint-disable-next-line max-params
export async function listRepositories(
  config: AuthConfig,
  workspace: string,
  page = 1,
  pagelen = 10,
  role?: string,
  q?: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.listRepositories(workspace, page, pagelen, role, q)
}

export async function getRepository(config: AuthConfig, workspace: string, repoSlug: string): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.getRepository(workspace, repoSlug)
}

export async function createRepository(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  options?: {description?: string; isPrivate?: boolean; language?: string; projectKey?: string},
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.createRepository(workspace, repoSlug, options)
}

// eslint-disable-next-line max-params
export async function deletePullRequestComment(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  commentId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.deletePullRequestComment(workspace, repoSlug, pullRequestId, commentId)
}

export async function deleteRepository(config: AuthConfig, workspace: string, repoSlug: string): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.deleteRepository(workspace, repoSlug)
}

// eslint-disable-next-line max-params
export async function listPullRequests(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  state?: string,
  page = 1,
  pagelen = 10,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.listPullRequests(workspace, repoSlug, state, page, pagelen)
}

export async function getPullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.getPullRequest(workspace, repoSlug, pullRequestId)
}

// eslint-disable-next-line max-params
export async function createPullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  title: string,
  sourceBranch: string,
  destinationBranch: string,
  description?: string,
  reviewers?: string[],
  autoAddReviewers = true,
): Promise<ApiResult> {
  const bb = await getClient(config)
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

// eslint-disable-next-line max-params
export async function updatePullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  fields: Record<string, unknown>,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.updatePullRequest(workspace, repoSlug, pullRequestId, fields)
}

// eslint-disable-next-line max-params
export async function updatePullRequestComment(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  commentId: number,
  content: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.updatePullRequestComment(workspace, repoSlug, pullRequestId, commentId, content)
}

// eslint-disable-next-line max-params
export async function mergePullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  mergeStrategy?: string,
  closeSrcBranch?: boolean,
  message?: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.mergePullRequest(workspace, repoSlug, pullRequestId, mergeStrategy, closeSrcBranch, message)
}

// eslint-disable-next-line max-params
export async function createPullRequestComment(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  content: string,
  inline?: {line: number; path: string},
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.createPullRequestComment(workspace, repoSlug, pullRequestId, content, inline)
}

export async function declinePullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.declinePullRequest(workspace, repoSlug, pullRequestId)
}

export async function approvePullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.approvePullRequest(workspace, repoSlug, pullRequestId)
}

export async function getPullRequestDiff(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.getPullRequestDiff(workspace, repoSlug, pullRequestId)
}

export async function unapprovePullRequest(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.unapprovePullRequest(workspace, repoSlug, pullRequestId)
}

// eslint-disable-next-line max-params
export async function listPullRequestComments(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  page = 1,
  pagelen = 10,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.listPullRequestComments(workspace, repoSlug, pullRequestId, page, pagelen)
}

// eslint-disable-next-line max-params
export async function replyToPullRequestComment(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pullRequestId: number,
  commentId: number,
  content: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.replyToPullRequestComment(workspace, repoSlug, pullRequestId, commentId, content)
}

// eslint-disable-next-line max-params
export async function listPipelines(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  page = 1,
  pagelen = 10,
  sort?: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.listPipelines(workspace, repoSlug, page, pagelen, sort)
}

export async function getPipeline(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  pipelineUuid: string,
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.getPipeline(workspace, repoSlug, pipelineUuid)
}

export async function triggerPipeline(
  config: AuthConfig,
  workspace: string,
  repoSlug: string,
  target: {refName: string; refType: string; selector?: {pattern?: string; type?: string}},
): Promise<ApiResult> {
  const bb = await getClient(config)
  return bb.triggerPipeline(workspace, repoSlug, target)
}
