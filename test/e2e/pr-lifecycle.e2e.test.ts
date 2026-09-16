import {expect} from 'chai'

import {
  cleanupRun,
  FEATURE_BRANCH,
  listRepos,
  refHttpStatus,
  RUN_ID,
  RUN_PREFIX,
  seedBranch,
  seedRepo,
} from './fixtures.js'
import {createConfigDir, removeConfigDir, runCli, runCliJson} from './helpers.js'

type Comment = {content: {raw: string}; id: number}
type PullRequest = {
  destination: {branch: {name: string}}
  id: number
  source: {branch: {name: string}}
  state: string
  title: string
}

const DECLINE_BRANCH = 'e2e-feature-b'

describe('e2e: pr lifecycle', () => {
  let configDir: string
  let slug: string
  let featureSha: string
  let mergeId: number
  let declineId: number
  let commentId: number

  before(async () => {
    configDir = await createConfigDir()
    const seeded = await seedRepo('pr')
    slug = seeded.slug
    featureSha = seeded.featureSha
    // The decline leg gets its own source branch so the merge leg's
    // --close-source-branch never pulls a ref out from under it.
    await seedBranch(slug, seeded.featureSha, DECLINE_BRANCH)
  })

  // allSettled is unnecessary (cleanupRun tolerates deleted repos); the
  // finally guarantees the token-bearing config dir is removed regardless.
  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('creates two open pull requests through the CLI', async () => {
    const title = `[e2e ${RUN_ID}] merge leg`
    const created = await runCliJson<{data: PullRequest; success: boolean}>(
      [
        'bb',
        'pr',
        'create',
        process.env.E2E_WORKSPACE!,
        slug,
        '--title',
        title,
        '--source',
        FEATURE_BRANCH,
        '--destination',
        'main',
      ],
      configDir,
    )
    expect(created.success).to.be.true
    mergeId = created.data.id
    expect(mergeId).to.be.a('number')

    const second = await runCliJson<{data: PullRequest; success: boolean}>(
      [
        'bb',
        'pr',
        'create',
        process.env.E2E_WORKSPACE!,
        slug,
        '--title',
        `[e2e ${RUN_ID}] decline leg`,
        '--source',
        DECLINE_BRANCH,
        '--destination',
        'main',
      ],
      configDir,
    )
    expect(second.success).to.be.true
    declineId = second.data.id
    expect(declineId).to.not.equal(mergeId)
  })

  it('reads a pull request back with source and destination intact', async () => {
    const payload = await runCliJson<{data: PullRequest; success: boolean}>(
      ['bb', 'pr', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.state).to.equal('OPEN')
    expect(payload.data.source.branch.name).to.equal(FEATURE_BRANCH)
    expect(payload.data.destination.branch.name).to.equal('main')
    expect(payload.data.title).to.contain(RUN_ID)
  })

  it('lists the pull requests as OPEN', async () => {
    const payload = await runCliJson<{data: {values: Array<{id: number}>}}>(
      ['bb', 'pr', 'list', process.env.E2E_WORKSPACE!, slug, '--state', 'OPEN'],
      configDir,
    )
    expect(payload.data.values.map((pr) => pr.id)).to.have.members([mergeId, declineId])
  })

  it('comments on the pull request and lists the comment back', async () => {
    const body = `[e2e ${RUN_ID}] first comment`
    const created = await runCliJson<{data: Comment; success: boolean}>(
      ['bb', 'pr', 'comment', process.env.E2E_WORKSPACE!, slug, String(mergeId), '--body', body],
      configDir,
    )
    expect(created.success).to.be.true
    commentId = created.data.id

    const listed = await runCliJson<{data: {values: Comment[]}}>(
      ['bb', 'pr', 'comments', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(listed.data.values.map((comment) => comment.content.raw)).to.include(body)
  })

  it('replies to the comment as a nested child', async () => {
    const replied = await runCliJson<{data: {content: {raw: string}; parent?: {id: number}}; success: boolean}>(
      [
        'bb',
        'pr',
        'comment-reply',
        process.env.E2E_WORKSPACE!,
        slug,
        String(mergeId),
        String(commentId),
        '--body',
        `[e2e ${RUN_ID}] reply`,
      ],
      configDir,
    )
    expect(replied.success).to.be.true
    expect(replied.data.parent?.id).to.equal(commentId)
  })

  it('updates the comment text in place', async () => {
    const updated = `[e2e ${RUN_ID}] edited comment`
    const result = await runCliJson<{success: boolean}>(
      [
        'bb',
        'pr',
        'comment-update',
        process.env.E2E_WORKSPACE!,
        slug,
        String(mergeId),
        String(commentId),
        '--body',
        updated,
      ],
      configDir,
    )
    expect(result.success).to.be.true

    const listed = await runCliJson<{data: {values: Comment[]}}>(
      ['bb', 'pr', 'comments', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(listed.data.values.map((comment) => comment.content.raw)).to.include(updated)
  })

  it('deletes the comment, after which the list no longer carries it', async () => {
    const result = await runCliJson<{success: boolean}>(
      ['bb', 'pr', 'comment-delete', process.env.E2E_WORKSPACE!, slug, String(mergeId), String(commentId)],
      configDir,
    )
    expect(result.success).to.be.true

    const listed = await runCliJson<{data: {values: Array<{id: number}>}}>(
      ['bb', 'pr', 'comments', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(listed.data.values.map((comment) => comment.id)).to.not.include(commentId)
  })

  // To be confirmed on the first live run: Bitbucket resolves *tasks*, and a
  // plain comment is not a task — the expectation below is that the resolve
  // is refused (success:false under the pinned exit-0 contract). If the
  // sandbox resolves plain comments too, flip this assertion deliberately.
  it('refuses to resolve a plain (non-task) comment', async () => {
    const target = await runCliJson<{data: Comment; success: boolean}>(
      [
        'bb',
        'pr',
        'comment',
        process.env.E2E_WORKSPACE!,
        slug,
        String(mergeId),
        '--body',
        `[e2e ${RUN_ID}] resolve target`,
      ],
      configDir,
    )
    expect(target.success).to.be.true

    const resolved = await runCliJson<{success: boolean}>(
      ['bb', 'pr', 'comment-resolve', process.env.E2E_WORKSPACE!, slug, String(mergeId), String(target.data.id)],
      configDir,
    )
    expect(resolved.success).to.be.false
  })

  it('records activity on the pull request', async () => {
    const payload = await runCliJson<{data: {values: unknown[]}}>(
      ['bb', 'pr', 'activity', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(payload.data.values.length).to.be.greaterThan(0)
  })

  it('attributes the branch commits to the pull request', async () => {
    const payload = await runCliJson<{data: {values: Array<{hash: string}>}}>(
      ['bb', 'pr', 'commits', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(payload.data.values.map((commit) => commit.hash)).to.include(featureSha)
  })

  it('renders the diff as plain text, not JSON', async () => {
    const {code, stdout} = await runCli(
      ['bb', 'pr', 'diff', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(code, stdout).to.equal(0)
    expect(stdout).to.contain('feature.txt')
    expect(() => JSON.parse(stdout)).to.throw()
  })

  it('approves and unapproves the pull request', async () => {
    const approved = await runCliJson<{success: boolean}>(
      ['bb', 'pr', 'approve', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(approved.success).to.be.true

    const unapproved = await runCliJson<{success: boolean}>(
      ['bb', 'pr', 'unapprove', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(unapproved.success).to.be.true
  })

  it('updates the pull request title in place', async () => {
    const newTitle = `[e2e ${RUN_ID}] merge leg (edited)`
    const result = await runCliJson<{success: boolean}>(
      ['bb', 'pr', 'update', process.env.E2E_WORKSPACE!, slug, String(mergeId), '--title', newTitle],
      configDir,
    )
    expect(result.success).to.be.true

    const fetched = await runCliJson<{data: PullRequest}>(
      ['bb', 'pr', process.env.E2E_WORKSPACE!, slug, String(mergeId)],
      configDir,
    )
    expect(fetched.data.title).to.equal(newTitle)
  })

  it('declines the second pull request', async () => {
    const declined = await runCliJson<{data: PullRequest; success: boolean}>(
      ['bb', 'pr', 'decline', process.env.E2E_WORKSPACE!, slug, String(declineId)],
      configDir,
    )
    expect(declined.success).to.be.true
    expect(declined.data.state).to.equal('DECLINED')
  })

  it('merges the first pull request and closes its source branch', async () => {
    const merged = await runCliJson<{data: PullRequest; success: boolean}>(
      [
        'bb',
        'pr',
        'merge',
        process.env.E2E_WORKSPACE!,
        slug,
        String(mergeId),
        '--close-source-branch',
        '--message',
        `[e2e ${RUN_ID}] merged`,
      ],
      configDir,
    )
    expect(merged.success).to.be.true
    expect(merged.data.state).to.equal('MERGED')

    // close_source_branch is the part most easily dropped by a body-shaped
    // regression, so the branch deletion is asserted explicitly.
    expect(await refHttpStatus(slug, FEATURE_BRANCH)).to.equal(404)
  })

  it('leaves only the run-prefix fixtures behind for cleanup', async () => {
    const names = (await listRepos(RUN_PREFIX)).map((repo) => repo.name)
    expect(names).to.deep.equal([slug])
  })
})
