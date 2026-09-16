import {expect} from 'chai'

import {cleanupRun, FEATURE_BRANCH, listRepos, RUN_ID, RUN_PREFIX, seedRepo} from './fixtures.js'
import {createConfigDir, removeConfigDir, runCliJson, runCliOk} from './helpers.js'

type Repo = {full_name: string; slug?: string}
type Paged<T> = {page: number; pagelen: number; size: number; values: T[]}

// Each e2e file seeds under the same run prefix but cleans up after itself,
// so file-scoped naming keeps count assertions here deterministic even though
// mocha runs the files sequentially.
describe('e2e: read paths', () => {
  let configDir: string
  let first: {featureSha: string; mainSha: string; slug: string}
  let second: {featureSha: string; mainSha: string; slug: string}

  before(async () => {
    configDir = await createConfigDir()
    first = await seedRepo('read-a')
    second = await seedRepo('read-b')
  })

  // allSettled is unnecessary here (cleanupRun tolerates already-deleted
  // repos), but the finally guarantees the token-bearing config dir never
  // outlives the suite.
  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('gets the fixture workspace', async () => {
    const payload = await runCliJson<{data: {slug: string}; success: boolean}>(
      ['bb', 'workspace', process.env.E2E_WORKSPACE!],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.slug).to.equal(process.env.E2E_WORKSPACE)
  })

  it('gets a single fixture repo', async () => {
    const payload = await runCliJson<{data: Repo; success: boolean}>(
      ['bb', 'repo', process.env.E2E_WORKSPACE!, first.slug],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.full_name).to.equal(`${process.env.E2E_WORKSPACE}/${first.slug}`)
  })

  it('lists both fixture repos by name query', async () => {
    // The run id is the hyphen-delimited token every fixture slug carries, so
    // the tokenized ~ match scopes this list to this run and nothing else.
    const payload = await runCliJson<{data: Paged<Repo>}>(
      ['bb', 'repo', 'list', process.env.E2E_WORKSPACE!, '--q', `name~"${RUN_ID}"`],
      configDir,
    )
    const slugs = payload.data.values.map((repo) => repo.full_name.split('/', 2)[1])
    expect(slugs).to.have.members([first.slug, second.slug])
    expect(payload.data.size).to.equal(2)
  })

  it('returns an empty page for a name query matching nothing and still exits 0', async () => {
    const payload = await runCliJson<{data: Paged<Repo>}>(
      ['bb', 'repo', 'list', process.env.E2E_WORKSPACE!, '--q', 'name="e2e-no-such-repo"'],
      configDir,
    )
    expect(payload.data.values).to.deep.equal([])
    expect(payload.data.size).to.equal(0)
  })

  // One repo per page, and the two pages together must cover both fixtures
  // with no overlap — the regression class this closes is a broken/ignored
  // page parameter.
  it('pages through the fixture repos with --pagelen and --page', async () => {
    const args = ['bb', 'repo', 'list', process.env.E2E_WORKSPACE!, '--q', `name~"${RUN_ID}"`, '--pagelen', '1']
    const firstPage = await runCliJson<{data: Paged<Repo>}>([...args, '--page', '1'], configDir)
    const secondPage = await runCliJson<{data: Paged<Repo>}>([...args, '--page', '2'], configDir)

    expect(firstPage.data.values).to.have.lengthOf(1)
    expect(secondPage.data.values).to.have.lengthOf(1)
    expect(firstPage.data.values[0].full_name).to.not.equal(secondPage.data.values[0].full_name)

    const slugs = [firstPage.data.values[0], secondPage.data.values[0]].map((repo) => repo.full_name.split('/', 2)[1])
    expect(slugs).to.have.members([first.slug, second.slug])
  })

  it('lists the main-branch commit and fetches it by hash', async () => {
    const listed = await runCliJson<{data: Paged<{hash: string}>}>(
      ['bb', 'commit', 'list', process.env.E2E_WORKSPACE!, first.slug],
      configDir,
    )
    // The default branch carries exactly the README commit; the feature
    // commit lives on the feature branch and must not leak in here.
    expect(listed.data.values.map((commit) => commit.hash)).to.deep.equal([first.mainSha])

    const fetched = await runCliJson<{data: {hash: string}; success: boolean}>(
      ['bb', 'commit', process.env.E2E_WORKSPACE!, first.slug, first.mainSha],
      configDir,
    )
    expect(fetched.success).to.be.true
    expect(fetched.data.hash).to.equal(first.mainSha)
  })

  it('restricts commits to a branch with --include', async () => {
    const payload = await runCliJson<{data: Paged<{hash: string}>}>(
      ['bb', 'commit', 'list', process.env.E2E_WORKSPACE!, first.slug, '--include', FEATURE_BRANCH],
      configDir,
    )
    // Newest first: the feature commit precedes the README commit, and both
    // are reachable from the included branch.
    expect(payload.data.values.map((commit) => commit.hash)).to.deep.equal([first.featureSha, first.mainSha])
  })

  it('emits TOON rather than JSON under --toon', async () => {
    const {stdout} = await runCliOk(['bb', 'workspace', 'list', '--toon'], configDir)
    expect(() => JSON.parse(stdout)).to.throw()
    expect(stdout).to.contain('success: true')
    expect(stdout).to.contain(process.env.E2E_WORKSPACE!)
  })

  it('starts the fixture repo with an empty pull request list', async () => {
    const payload = await runCliJson<{data: Paged<unknown>}>(
      ['bb', 'pr', 'list', process.env.E2E_WORKSPACE!, first.slug],
      configDir,
    )
    expect(payload.data.size).to.equal(0)
    expect(payload.data.values).to.deep.equal([])
  })

  it('sees both fixture repos through the raw listRepos oracle', async () => {
    const names = (await listRepos(RUN_PREFIX)).map((repo) => repo.name)
    expect(names).to.include(first.slug)
    expect(names).to.include(second.slug)
  })
})
