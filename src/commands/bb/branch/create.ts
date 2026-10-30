import {type ApiResult, type AuthConfig, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {
  clearClients,
  createBranch,
  getBranch,
  getCommit,
  getRepository,
} from '../../../bitbucket/bitbucket-client.js'

/** Bitbucket mints SHA-1 commit hashes: 40 hexadecimal characters. */
const MAX_COMMIT_SHA_LENGTH = 40

type BranchPayload = {target?: {hash?: string}}
type CommitPayload = {hash?: string}
type RepositoryPayload = {mainbranch?: {name?: string}}

/** Either the resolved commit to branch from, or the failure to report instead of creating. */
type TargetResolution = {error?: unknown; hash?: string}

/**
 * Whether `target` should be resolved as a commit rather than a branch name:
 * hexadecimal and no longer than a full SHA-1. Abbreviated hashes are accepted
 * and canonicalized by the commit lookup; Bitbucket rejects invalid ones.
 */
function isCommitShaCandidate(target: string): boolean {
  if (target.length === 0 || target.length > MAX_COMMIT_SHA_LENGTH) return false
  for (const char of target) {
    const isDigit = char >= '0' && char <= '9'
    const isLowerHex = char >= 'a' && char <= 'f'
    const isUpperHex = char >= 'A' && char <= 'F'
    if (!isDigit && !isLowerHex && !isUpperHex) return false
  }

  return true
}

/**
 * Resolves an explicit --target to the commit hash the new branch points at.
 *
 * There is deliberately no fallback between the two lookups: a hexadecimal
 * target that Bitbucket refuses is reported as-is rather than masked by
 * probing the branch endpoint, and vice versa.
 */
async function resolveExplicitTargetHash(
  auth: AuthConfig,
  workspace: string,
  repoSlug: string,
  target: string,
): Promise<TargetResolution> {
  if (isCommitShaCandidate(target)) {
    const commit = await getCommit(auth, workspace, repoSlug, target)
    if (!commit.success) {
      return {error: commit.error}
    }

    const hash = (commit.data as CommitPayload | undefined)?.hash
    return hash ? {hash} : {error: `Commit '${target}' response carries no hash.`}
  }

  const branch = await getBranch(auth, workspace, repoSlug, target)
  if (!branch.success) {
    return {error: branch.error}
  }

  const hash = (branch.data as BranchPayload | undefined)?.target?.hash
  return hash ? {hash} : {error: `Branch '${target}' response carries no target hash.`}
}

/**
 * Resolves the create target when no --target is given: the repository's
 * default branch (its reported mainbranch) at its current tip. An empty
 * repository has neither, so resolution fails instead of guessing `main`.
 */
async function resolveDefaultTargetHash(
  auth: AuthConfig,
  workspace: string,
  repoSlug: string,
): Promise<TargetResolution> {
  const repo = await getRepository(auth, workspace, repoSlug)
  if (!repo.success) {
    return {error: repo.error}
  }

  const mainbranch = (repo.data as RepositoryPayload | undefined)?.mainbranch?.name
  if (!mainbranch) {
    return {error: 'Repository response carries no mainbranch; pass --target with a commit hash or branch name.'}
  }

  const branch = await getBranch(auth, workspace, repoSlug, mainbranch)
  if (!branch.success) {
    return {error: branch.error}
  }

  const hash = (branch.data as BranchPayload | undefined)?.target?.hash
  return hash ? {hash} : {error: `Branch '${mainbranch}' response carries no target hash.`}
}

export default class BranchCreate extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description =
    "Create a new branch, from a commit hash, another branch, or the repository's default branch by default"

  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --name feature/x',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --name feature/y --target feature/x',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --name feature/z --target a1b2c3d4 -p work',
  ]

  static override flags = {
    name: Flags.string({description: 'New branch name', required: true}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    target: Flags.string({
      description:
        "Commit hash or branch name to branch from; hexadecimal strings up to 40 characters are resolved as commits (defaults to the repository's default branch)",
      required: false,
    }),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(BranchCreate)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    let result: ApiResult
    try {
      const resolution = flags.target
        ? await resolveExplicitTargetHash(auth, args.workspace, args.repoSlug, flags.target)
        : await resolveDefaultTargetHash(auth, args.workspace, args.repoSlug)

      result = resolution.hash
        ? await createBranch(auth, args.workspace, args.repoSlug, {name: flags.name, targetHash: resolution.hash})
        : {error: resolution.error, success: false}
    } finally {
      clearClients()
    }

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
