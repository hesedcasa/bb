import {Buffer} from 'node:buffer'
import {randomBytes} from 'node:crypto'

import {requireEnv} from './helpers.js'

/**
 * One token per mocha process, so concurrent runs never delete each other's
 * fixtures.
 *
 * E2E_RUN_ID overrides it so a *separate* process can address this run's
 * fixtures by name prefix — `scripts/e2e.sh` and the CI workflow both set it,
 * which is what lets their post-run sweep reclaim fixtures a killed mocha
 * never got to clean up.
 */
export const RUN_ID = process.env.E2E_RUN_ID || randomBytes(4).toString('hex')
/** Prefix carried by every fixture repo, so a crashed run can be reclaimed later. */
export const SHARED_PREFIX = 'e2e-'
/** Run-scoped prefix. Destructive queries for this run's fixtures never look past it. */
export const RUN_PREFIX = `${SHARED_PREFIX}${RUN_ID}-`

/** The feature branch seedRepo() creates, so PR tests have a real diff to work with. */
export const FEATURE_BRANCH = 'e2e-feature'

type BbResponse = {body: unknown; status: number}

type CallOptions = {
  body?: unknown
  form?: FormData
}

async function call(method: string, endpoint: string, options: CallOptions = {}): Promise<BbResponse> {
  const {apiToken, email} = requireEnv()
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
  }

  // A FormData body must reach fetch unmolested: native fetch derives the
  // multipart boundary from it, so content-type is set only for JSON bodies.
  let payload: BodyInit | undefined
  if (options.form) {
    payload = options.form
  } else {
    payload = options.body === undefined ? undefined : JSON.stringify(options.body)
    if (payload !== undefined) headers['content-type'] = 'application/json'
  }

  const response = await fetch(`https://api.bitbucket.org/2.0${endpoint}`, {
    body: payload,
    headers,
    method,
  })

  const text = await response.text()
  return {body: text ? JSON.parse(text) : null, status: response.status}
}

function assertStatus(what: string, status: number, body: unknown, expected: number[]): void {
  if (!expected.includes(status)) {
    throw new Error(`${what} failed: ${status} ${JSON.stringify(body)}`)
  }
}

/**
 * Reads the commit hash a branch points at.
 *
 * The src upload endpoint answers 201 with an empty body — no commit hash to
 * parse — so every hash this suite needs is read back from the branch tip
 * instead. Bitbucket reads are immediately consistent, so the tip is the
 * commit that was just uploaded; no polling.
 *
 * @param repo The repository API path, e.g. `/repositories/<ws>/<slug>`.
 * @param branch The branch whose tip to read.
 * @returns The full commit hash.
 */
async function tipSha(repo: string, branch: string): Promise<string> {
  const {body, status} = await call('GET', `${repo}/commits/${branch}?pagelen=1`)
  assertStatus(`tipSha ${branch}`, status, body, [200])
  const hash = (body as {values?: Array<{hash?: string}>}).values?.[0]?.hash
  if (!hash) {
    throw new Error(`tipSha ${branch} failed: commit list carried no hash`)
  }

  return hash
}

/**
 * Reads a repo's default branch name from its `mainbranch` field.
 *
 * Not a constant: the sandbox workspace defaults new repos to `master`, and a
 * hardcoded `main` would break the tip lookup above.
 *
 * @param repo The repository API path, e.g. `/repositories/<ws>/<slug>`.
 * @param slug The repository slug, for error messages.
 * @returns The default branch name.
 */
async function defaultBranchName(repo: string, slug: string): Promise<string> {
  const {body, status} = await call('GET', repo)
  assertStatus(`seedRepo ${slug} repo read`, status, body, [200])
  const name = (body as {mainbranch?: {name?: string}}).mainbranch?.name
  if (!name) {
    throw new Error(`seedRepo ${slug} failed: repository response carries no mainbranch`)
  }

  return name
}

/**
 * Creates a fixture repository via the REST API directly.
 *
 * Fixtures are never created through the CLI: they are the oracle the CLI is
 * checked against, so they must not share its code path. The repo is seeded
 * with a README on the default branch and a second commit on `e2e-feature`,
 * so PR tests have a real diff without needing git installed.
 *
 * @param purpose Short suffix for the repo name, after the run prefix.
 * @returns The slug, the repo's default branch name, and both commit hashes.
 */
export async function seedRepo(purpose: string): Promise<{
  defaultBranch: string
  featureSha: string
  mainSha: string
  slug: string
}> {
  const {workspace} = requireEnv()
  const slug = `${RUN_PREFIX}${purpose}`
  const repo = `/repositories/${workspace}/${slug}`

  const created = await call('PUT', repo, {
    body: {description: `[e2e ${RUN_ID}] ${purpose}`, is_private: true, scm: 'git'},
  })
  assertStatus(`seedRepo ${slug}`, created.status, created.body, [200, 201])

  // First commit lands on the default branch and is what makes the repo
  // readable by the commit commands. The src endpoint answers 201 with an
  // empty body, so the commit's hash is read back from the branch tip.
  const readme = new FormData()
  readme.append('README.md', `# e2e fixture\n\nCreated by the bb e2e suite, run ${RUN_ID}.\n`)
  const mainCommit = await call('POST', `${repo}/src`, {form: readme})
  assertStatus(`seedRepo ${slug} main commit`, mainCommit.status, mainCommit.body, [201])
  const defaultBranch = await defaultBranchName(repo, slug)
  const mainSha = await tipSha(repo, defaultBranch)

  const branch = await call('POST', `${repo}/refs/branches`, {
    body: {name: FEATURE_BRANCH, target: {hash: mainSha}},
  })
  assertStatus(`seedRepo ${slug} branch`, branch.status, branch.body, [200, 201])

  // A second commit on the branch, so main ← e2e-feature has a diff to show.
  const feature = new FormData()
  feature.append('branch', FEATURE_BRANCH)
  feature.append('feature.txt', `feature file for run ${RUN_ID}\n`)
  const featureCommit = await call('POST', `${repo}/src`, {form: feature})
  assertStatus(`seedRepo ${slug} feature commit`, featureCommit.status, featureCommit.body, [201])
  const featureSha = await tipSha(repo, FEATURE_BRANCH)

  return {defaultBranch, featureSha, mainSha, slug}
}

/**
 * Lists fixture repos whose name starts with `prefix`.
 *
 * Always scoped to the fixture workspace. Both `cleanupRun` and `sweepStale`
 * are destructive queries driven by ambient environment variables with no
 * other guard, so scoping every lookup here — structurally, once — bounds
 * their blast radius to repos that carry the `e2e-` prefix instead of
 * everything the credentials can see.
 *
 * Pages to the end rather than stopping at the first 100: a caller that
 * stopped early would delete one page of fixtures and report success.
 *
 * @param prefix The name prefix to match.
 * @returns Name, description, and created_on for each matching repo.
 */
export async function listRepos(
  prefix: string,
): Promise<Array<{createdOn: string; description: string; name: string}>> {
  const {workspace} = requireEnv()
  const repos: Array<{createdOn: string; description: string; name: string}> = []
  let page = 1

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- see above
    const {body, status} = await call('GET', `/repositories/${workspace}?page=${page}&pagelen=100&role=admin`)
    assertStatus(`listRepos page ${page}`, status, body, [200])

    const pageData = body as {
      next?: string
      values?: Array<{created_on?: string; description?: string; name?: string}>
    }
    for (const repo of pageData.values ?? []) {
      if (repo.name?.startsWith(prefix)) {
        repos.push({createdOn: repo.created_on ?? '', description: repo.description ?? '', name: repo.name})
      }
    }

    if (!pageData.next) return repos
    page++
  }
}

/**
 * Creates an extra branch at an existing commit.
 *
 * The decline leg of the PR lifecycle uses its own source branch, so it never
 * shares the merge leg's branch — merging with --close-source-branch deletes
 * the shared ref out from under the other pull request otherwise.
 *
 * @param slug The repository slug.
 * @param fromSha The commit the branch points at.
 * @param name The branch name to create.
 */
export async function seedBranch(slug: string, fromSha: string, name: string): Promise<void> {
  const {workspace} = requireEnv()
  const branch = await call('POST', `/repositories/${workspace}/${slug}/refs/branches`, {
    body: {name, target: {hash: fromSha}},
  })
  assertStatus(`seedBranch ${name}`, branch.status, branch.body, [200, 201])
}

/**
 * Reads a ref's HTTP status straight from the REST API.
 *
 * @param slug The repository slug.
 * @param name The branch name.
 * @returns The status code: 200 while the branch exists, 404 once deleted.
 */
export async function refHttpStatus(slug: string, name: string): Promise<number> {
  const {workspace} = requireEnv()
  const {status} = await call('GET', `/repositories/${workspace}/${slug}/refs/branches/${name}`)
  return status
}

/**
 * Reads a repository's HTTP status straight from the REST API.
 *
 * Bitbucket reads are immediately consistent, so unlike the jira suite there
 * is no index lag to poll: 404 means gone, right now.
 *
 * @param slug The repository slug.
 * @returns The status code: 200 while the repo exists, 404 once deleted.
 */
export async function repoHttpStatus(slug: string): Promise<number> {
  const {workspace} = requireEnv()
  const {status} = await call('GET', `/repositories/${workspace}/${slug}`)
  return status
}

/**
 * Deletes a repo, tolerating one that is already gone.
 *
 * @param slug The repository slug.
 */
export async function deleteRepo(slug: string): Promise<void> {
  const {workspace} = requireEnv()
  const {status} = await call('DELETE', `/repositories/${workspace}/${slug}`)
  if (status !== 204 && status !== 404) {
    throw new Error(`deleteRepo ${slug} failed: ${status}`)
  }
}

/**
 * Deletes every repo in `slugs`, tolerating individual failures until all
 * deletions have been attempted, then throwing if any actually failed.
 *
 * Promise.all would abandon the remaining deletions on the first rejection;
 * allSettled ensures a single stuck repo never masks failures to delete the
 * rest.
 *
 * @param slugs The repository slugs to delete.
 */
async function deleteAll(slugs: string[]): Promise<void> {
  const results = await Promise.allSettled(slugs.map((slug) => deleteRepo(slug)))
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failures.length > 0) {
    throw new Error(
      `deleteAll: ${failures.length}/${slugs.length} deletion(s) failed: ${failures.map((f) => String(f.reason)).join('; ')}`,
    )
  }
}

/**
 * Whether a repo looks like one this suite created.
 *
 * `sweepStale` is a prefix query with no other guard, so this predicate carries
 * the real burden of never selecting a legitimate workspace repo that merely
 * starts with `e2e-`. Three properties must hold together: the description
 * starts with the `[e2e ` marker every fixture writes, the run id inside it
 * has a shape this suite actually produces, and the name corroborates the same
 * run id. The shape check runs on the description's run id rather than a token
 * of the name because CI run ids themselves contain a hyphen.
 *
 * String methods only — no regex literals in test/** (see CLAUDE.md). An
 * E2E_RUN_ID outside the three shapes fails safe: the sweep leaves those
 * fixtures for a manual delete rather than guessing.
 */
function isOurs(name: string, description: string): boolean {
  const marker = '[e2e '
  if (!description.startsWith(marker)) return false
  const closing = description.indexOf(']')
  if (closing === -1) return false

  const runId = description.slice(marker.length, closing)
  return isRunShaped(runId) && name.startsWith(`${SHARED_PREFIX}${runId}-`)
}

/**
 * Whether `runId` matches a run id this suite produces: `local-<pid>` from
 * e2e.sh, `<workflow run id>-<attempt>` from CI, or the 8-hex-character local
 * default.
 */
function isRunShaped(runId: string): boolean {
  if (runId.startsWith('local-')) return isDigits(runId.slice('local-'.length))

  const separator = runId.indexOf('-')
  if (separator !== -1) {
    return isDigits(runId.slice(0, separator)) && isDigits(runId.slice(separator + 1))
  }

  return runId.length === 8 && isHexadecimal(runId)
}

function isDigits(text: string): boolean {
  if (text.length === 0) return false
  for (const char of text) {
    if (char < '0' || char > '9') return false
  }

  return true
}

function isHexadecimal(text: string): boolean {
  if (text.length === 0) return false
  for (const char of text) {
    const digit = char >= '0' && char <= '9'
    const lowerHex = char >= 'a' && char <= 'f'
    if (!digit && !lowerHex) return false
  }

  return true
}

/**
 * Deletes every fixture created by this process.
 *
 * No `created`-set union is needed (unlike the jira suite): Bitbucket list
 * reads are immediately consistent, so the prefix lookup sees everything the
 * run created the moment it exists.
 *
 * Deliberately name-scoped rather than isOurs-gated: the prefix embeds this
 * run's fresh random id, and staying name-only means the backstop reclaims
 * fixtures even when a caller wrote a nonstandard description.
 */
export async function cleanupRun(): Promise<void> {
  await deleteAll((await listRepos(RUN_PREFIX)).map((repo) => repo.name))
}

/**
 * Deletes fixtures older than an hour, left behind by a crashed run.
 *
 * The age filter is what makes this safe to run while another suite is in
 * flight: it can only ever reclaim fixtures no live run still owns. The
 * isOurs predicate is the second guard — age alone would select any
 * `e2e-`-prefixed repo a user happened to create.
 *
 * @returns How many repos were deleted.
 */
export async function sweepStale(): Promise<number> {
  const cutoff = Date.now() - 60 * 60 * 1000
  const stale = (await listRepos(SHARED_PREFIX)).filter(
    (repo) => isOurs(repo.name, repo.description) && Date.parse(repo.createdOn) < cutoff,
  )
  await deleteAll(stale.map((repo) => repo.name))
  return stale.length
}
