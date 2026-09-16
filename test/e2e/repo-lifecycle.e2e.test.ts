import {expect} from 'chai'

import {cleanupRun, listRepos, repoHttpStatus, RUN_ID, RUN_PREFIX} from './fixtures.js'
import {createConfigDir, removeConfigDir, runCliJson} from './helpers.js'

describe('e2e: repo lifecycle', () => {
  let configDir: string
  const slug = `${RUN_PREFIX}lifecycle`

  before(async () => {
    configDir = await createConfigDir()
  })

  // The CLI-created repo carries the run prefix, so the prefix-scoped
  // backstop sweep reclaims it even if a test dies before the delete below.
  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('creates a repo through the CLI', async () => {
    const payload = await runCliJson<{data: {full_name: string; is_private: boolean}; success: boolean}>(
      [
        'bb',
        'repo',
        'create',
        process.env.E2E_WORKSPACE!,
        slug,
        '--private',
        '--description',
        `[e2e ${RUN_ID}] lifecycle`,
      ],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.full_name).to.equal(`${process.env.E2E_WORKSPACE}/${slug}`)
    expect(payload.data.is_private).to.be.true
  })

  it('sees the created repo through the raw oracle and the CLI', async () => {
    expect(await repoHttpStatus(slug)).to.equal(200)

    const payload = await runCliJson<{data: {full_name: string}; success: boolean}>(
      ['bb', 'repo', process.env.E2E_WORKSPACE!, slug],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.full_name).to.equal(`${process.env.E2E_WORKSPACE}/${slug}`)
  })

  it('deletes the repo, after which reading it fails', async () => {
    const deleted = await runCliJson<{data: unknown; success: boolean}>(
      ['bb', 'repo', 'delete', process.env.E2E_WORKSPACE!, slug],
      configDir,
    )
    expect(deleted.success).to.be.true
    // A 204 becomes {data: true} — the delete's only observable payload.
    expect(deleted.data).to.equal(true)

    const gone = await runCliJson<{success: boolean}>(['bb', 'repo', process.env.E2E_WORKSPACE!, slug], configDir)
    expect(gone.success).to.be.false
    expect(await repoHttpStatus(slug)).to.equal(404)
  })

  it('leaves no lifecycle fixture behind', async () => {
    const names = (await listRepos(RUN_PREFIX)).map((repo) => repo.name)
    expect(names).to.not.include(slug)
  })

  it('upserts rather than failing when the slug already exists', async () => {
    // createRepository is a PUT: Bitbucket treats a re-create of an existing
    // slug as an update, not an error. The suite pins that contract — and
    // that upserting does not duplicate the repo.
    const conflicting = `${RUN_PREFIX}conflict`
    // The first create is asserted too, so a pre-existing failure can't be
    // mistaken for upsert tolerance. It also writes the fixture description
    // marker, keeping the repo reclaimable by the stale sweep.
    const initial = await runCliJson<{success: boolean}>(
      [
        'bb',
        'repo',
        'create',
        process.env.E2E_WORKSPACE!,
        conflicting,
        '--private',
        '--description',
        `[e2e ${RUN_ID}] conflict`,
      ],
      configDir,
    )
    expect(initial.success).to.be.true

    const again = await runCliJson<{success: boolean}>(
      ['bb', 'repo', 'create', process.env.E2E_WORKSPACE!, conflicting, '--private'],
      configDir,
    )
    expect(again.success).to.be.true

    const names = (await listRepos(RUN_PREFIX)).map((repo) => repo.name)
    expect(names.filter((name) => name === conflicting)).to.have.lengthOf(1)
  })
})
