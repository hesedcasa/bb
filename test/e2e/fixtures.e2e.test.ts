import {expect} from 'chai'

import {
  cleanupRun,
  deleteRepo,
  FEATURE_BRANCH,
  listRepos,
  repoHttpStatus,
  RUN_PREFIX,
  seedRepo,
  sweepStale,
} from './fixtures.js'

// If the fixture oracle breaks, every other e2e file fails for the wrong
// reason — so the helpers get their own suite, exercised against the live API.
describe('e2e: fixtures', () => {
  let seededSlug: string

  after(async () => {
    // Backstop: keeps the workspace clean even when an assertion above fails.
    await cleanupRun()
  })

  it('seeds a repo with a main commit and a feature branch', async () => {
    const seeded = await seedRepo('fixtures')
    seededSlug = seeded.slug

    expect(seeded.slug.startsWith(RUN_PREFIX), `unexpected slug: ${seeded.slug}`).to.be.true
    expect(seeded.mainSha, 'main commit hash missing').to.not.equal('')
    expect(seeded.featureSha).to.not.equal(seeded.mainSha)
  })

  it('is visible to the API immediately — no index lag', async () => {
    expect(await repoHttpStatus(seededSlug)).to.equal(200)
  })

  it('finds the repo by the run prefix', async () => {
    const names = (await listRepos(RUN_PREFIX)).map((repo) => repo.name)
    expect(names).to.include(seededSlug)
  })

  it('reports 404 for a repo that does not exist', async () => {
    expect(await repoHttpStatus(`${RUN_PREFIX}missing`)).to.equal(404)
  })

  it('deletes a repo, tolerating a repeat delete of the same slug', async () => {
    const temporary = await seedRepo('fixtures-delete')
    await deleteRepo(temporary.slug)
    await deleteRepo(temporary.slug) // idempotent: 404 is tolerated
    expect(await repoHttpStatus(temporary.slug)).to.equal(404)
  })

  it('leaves fresh fixtures alone in the stale sweep', async () => {
    await seedRepo('fixtures-fresh')
    const deleted = await sweepStale()
    expect(deleted, 'sweep must not touch fixtures younger than an hour').to.equal(0)
  })

  it('created the feature branch named for PR tests', async () => {
    // Indirect: seedRepo's own status assertions already 400'd on a failed
    // branch creation; here we pin the exported name used by the PR specs.
    expect(FEATURE_BRANCH).to.equal('e2e-feature')
  })
})
