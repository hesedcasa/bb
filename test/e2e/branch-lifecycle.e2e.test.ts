import {expect} from 'chai'

import {
  deleteRepo,
  refHttpStatus,
  repoHttpStatus,
  seedBranch,
  seedRepo,
} from './fixtures.js'
import {createConfigDir, removeConfigDir, runCli, runCliJson} from './helpers.js'

type Branch = {name: string; target: {hash: string}}
type BranchPayload = {data: Branch; success: boolean}
type ListPayload = {data: {next?: string; values: Branch[]}; success: boolean}

/** The branch the acceptance criteria name, created with no --target. */
const DEFAULT_TARGET_BRANCH = 'feature/x'
/** A slash-containing source branch, seeded raw at the feature commit. */
const SOURCE_BRANCH = 'e2e-source/one'
const FROM_SOURCE_BRANCH = 'from/source-branch'
const FROM_SHA_BRANCH = 'from-sha'
/** Raw-seeded padding so the sorted pagination below spans more than one page. */
const PADDING_BRANCH = 'zz-extra'

// The e2e runner (scripts/e2e.sh) demands credentials before mocha starts,
// but it is not itself optional: pointing mocha straight at this file with no
// credentials would otherwise fail inside credentialed setup rather than
// skip. All three variables gate the suite, setup and teardown alike.
const hasCredentials = Boolean(
  process.env.BITBUCKET_EMAIL && process.env.BITBUCKET_API_TOKEN && process.env.E2E_WORKSPACE,
)

const describeBranchLifecycle = hasCredentials ? describe : describe.skip

describeBranchLifecycle('e2e: branch lifecycle', () => {
  let configDir: string
  let slug: string
  let mainSha: string
  let featureSha: string

  // eslint-disable-next-line mocha/no-top-level-hooks -- conditional describe alias
  before(async () => {
    configDir = await createConfigDir()
    const seeded = await seedRepo('branch')
    slug = seeded.slug
    // Distinct tips by construction: the seeded repo carries a README commit
    // on the default branch and a second commit on e2e-feature. If these ever
    // matched, the target assertions below would prove nothing.
    mainSha = seeded.mainSha
    featureSha = seeded.featureSha
    expect(featureSha).to.not.equal(mainSha)

    await seedBranch(slug, featureSha, SOURCE_BRANCH)
    await seedBranch(slug, mainSha, PADDING_BRANCH)
  })

  // The final test deletes the repo explicitly; this guard still runs (and
  // tolerates an already-gone repo) when an earlier assertion dies first.
  // Deleting the repository removes every branch created against it, so no
  // branch-delete operation is needed for cleanup.
  // The mocha plugin cannot see through the conditional describe/describe.skip
  // alias above and misreads these hooks as top-level.
  // eslint-disable-next-line mocha/no-top-level-hooks -- conditional describe alias
  after(async () => {
    try {
      await deleteRepo(slug)
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('creates a slash-named branch at the default-branch tip without --target', async () => {
    const created = await runCliJson<BranchPayload>(
      ['bb', 'branch', 'create', process.env.E2E_WORKSPACE!, slug, '--name', DEFAULT_TARGET_BRANCH],
      configDir,
    )
    expect(created.success, JSON.stringify(created)).to.be.true
    expect(created.data.name).to.equal(DEFAULT_TARGET_BRANCH)
    expect(created.data.target.hash).to.equal(mainSha)
  })

  it('fetches the created branch back through the canonical route', async () => {
    // Raw oracle first: the ref exists and the CLI read matches it.
    expect(await refHttpStatus(slug, DEFAULT_TARGET_BRANCH)).to.equal(200)

    const payload = await runCliJson<BranchPayload>(
      ['bb', 'branch', process.env.E2E_WORKSPACE!, slug, DEFAULT_TARGET_BRANCH],
      configDir,
    )
    expect(payload.success, JSON.stringify(payload)).to.be.true
    expect(payload.data.name).to.equal(DEFAULT_TARGET_BRANCH)
    expect(payload.data.target.hash).to.equal(mainSha)
  })

  it('creates branches from a slash-containing branch and from a raw sha', async () => {
    const fromBranch = await runCliJson<BranchPayload>(
      ['bb', 'branch', 'create', process.env.E2E_WORKSPACE!, slug, '--name', FROM_SOURCE_BRANCH, '--target', SOURCE_BRANCH],
      configDir,
    )
    expect(fromBranch.success, JSON.stringify(fromBranch)).to.be.true
    expect(fromBranch.data.target.hash).to.equal(featureSha)

    const fromSha = await runCliJson<BranchPayload>(
      ['bb', 'branch', 'create', process.env.E2E_WORKSPACE!, slug, '--name', FROM_SHA_BRANCH, '--target', featureSha],
      configDir,
    )
    expect(fromSha.success, JSON.stringify(fromSha)).to.be.true
    expect(fromSha.data.target.hash).to.equal(featureSha)

    // Neither targets the default commit.
    expect(fromBranch.data.target.hash).to.not.equal(mainSha)
    expect(fromSha.data.target.hash).to.not.equal(mainSha)
  })

  it('lists the branches with default flags', async () => {
    const payload = await runCliJson<ListPayload>(['bb', 'branch', 'list', process.env.E2E_WORKSPACE!, slug], configDir)
    expect(payload.success, JSON.stringify(payload)).to.be.true

    const names = payload.data.values.map((branch) => branch.name)
    expect(names).to.include.members([
      DEFAULT_TARGET_BRANCH,
      SOURCE_BRANCH,
      FROM_SOURCE_BRANCH,
      FROM_SHA_BRANCH,
      PADDING_BRANCH,
    ])
  })

  it('follows next-page information through explicit numeric --page flags', async () => {
    const seen: string[] = []
    let page: number | undefined

    for (;;) {
      const args = [
        'bb',
        'branch',
        'list',
        process.env.E2E_WORKSPACE!,
        slug,
        '--sort',
        'name',
        '--pagelen',
        '2',
      ]
      if (page !== undefined) {
        args.push('--page', String(page))
      }

      // eslint-disable-next-line no-await-in-loop -- the next page is only known from the previous response
      const payload = await runCliJson<ListPayload>(args, configDir)
      expect(payload.success, JSON.stringify(payload)).to.be.true

      // Full pages carry exactly pagelen entries; only the last is short.
      if (payload.data.next) {
        expect(payload.data.values).to.have.lengthOf(2)
      }

      seen.push(...payload.data.values.map((branch) => branch.name))

      if (!payload.data.next) break
      page = Number(new URL(payload.data.next).searchParams.get('page'))
      expect(Number.isNaN(page), 'next link must carry a numeric page').to.be.false
    }

    // More than one page was actually traversed.
    expect(seen.length).to.be.greaterThan(2)
    expect(seen).to.include.members([DEFAULT_TARGET_BRANCH, FROM_SOURCE_BRANCH, FROM_SHA_BRANCH])
    // --sort name yields a stable, ascending traversal.
    // Array#toSorted needs lib es2023; this repo targets es2022 (cf. the
    // require-unicode-regexp note in CLAUDE.md), so sort a copy instead.
    // eslint-disable-next-line unicorn/no-array-sort -- no toSorted on es2022 lib
    expect(seen).to.deep.equal([...seen].sort())
  })

  it('isolates one branch with a q filter applied alongside sort', async () => {
    const payload = await runCliJson<ListPayload>(
      ['bb', 'branch', 'list', process.env.E2E_WORKSPACE!, slug, '--q', `name ~ "${FROM_SHA_BRANCH}"`, '--sort', 'name'],
      configDir,
    )
    expect(payload.success, JSON.stringify(payload)).to.be.true
    expect(payload.data.values.map((branch) => branch.name)).to.deep.equal([FROM_SHA_BRANCH])
  })

  it('renders a branch as TOON text, not a second JSON document', async () => {
    const {code, stdout} = await runCli(
      ['bb', 'branch', process.env.E2E_WORKSPACE!, slug, DEFAULT_TARGET_BRANCH, '--toon'],
      configDir,
    )
    expect(code, stdout).to.equal(0)
    expect(stdout).to.contain('success: true')
    expect(stdout).to.contain(DEFAULT_TARGET_BRANCH)
    expect(() => JSON.parse(stdout), 'TOON output must not be a JSON document').to.throw()
  })

  it('deletes the fixture repository, and every branch with it', async () => {
    await deleteRepo(slug)
    expect(await repoHttpStatus(slug)).to.equal(404)
    expect(await refHttpStatus(slug, DEFAULT_TARGET_BRANCH)).to.equal(404)
  })
})
