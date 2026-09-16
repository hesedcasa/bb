import {expect} from 'chai'

import {createConfigDir, redactSecret, removeConfigDir, runCli, runCliJson} from './helpers.js'

type Failure = {error: unknown; success: boolean}

describe('e2e: connection', () => {
  let configDir: string

  before(async () => {
    configDir = await createConfigDir()
  })

  after(async () => {
    await removeConfigDir(configDir)
  })

  it('authenticates with the default profile', async () => {
    const {code, stdout} = await runCli(['bb', 'auth', 'test'], configDir)
    expect(code, stdout).to.equal(0)
    expect(stdout).to.contain('Successful connection to Bitbucket')
  })

  it('fails auth test on a bad API token', async () => {
    const {code, stderr} = await runCli(['bb', 'auth', 'test', '--profile', 'broken'], configDir)
    expect(code).to.equal(2)
    expect(stderr).to.contain('failed')
  })

  it('errors on an unknown profile rather than falling back to the default', async () => {
    const {code, stdout} = await runCli(['bb', 'workspace', 'list', '--profile', 'nosuch'], configDir)
    expect(code).to.equal(1)
    expect(JSON.parse(stdout)).to.deep.equal({error: 'Missing authentication config.'})
  })

  it('redacts the API token from captured output', () => {
    // A synthetic secret, not the real API token: chai renders the actual
    // string in its failure message, so if this used the live token the one
    // circumstance where this test fails (a redaction regression) would print
    // the credential into the terminal and CI logs. redactSecret is a pure
    // string function, so a synthetic value proves the same property with zero
    // exposure.
    const secret = 'SEKRET-PLACEHOLDER-0001'
    const text = `some output embedding ${secret} in the middle of it`

    expect(redactSecret(text, secret)).to.not.include(secret)
  })

  it('leaves text untouched when there is no secret to redact', () => {
    const text = 'plain output with no secret in it'

    expect(redactSecret(text, undefined)).to.equal(text)
    expect(redactSecret(text, '')).to.equal(text)
  })

  // Pinned as observed, not as desired. Unlike the jira CLI, a bb command
  // whose ApiResult reports success:false still exits 0 — the failure lives in
  // the payload, not the exit code. Under a bad token Bitbucket answers 401
  // with an empty body, which the API layer surfaces as error: ''.
  it('reports success:false (exit 0) from list endpoints under a bad token', async () => {
    const {code, stdout} = await runCli(
      ['bb', 'repo', 'list', process.env.E2E_WORKSPACE!, '--profile', 'broken'],
      configDir,
    )
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as Failure
    expect(payload.success).to.be.false
    expect(payload.error).to.equal('')
  })

  // Same contract for a missing single resource: 404 becomes success:false in
  // the payload with Bitbucket's error envelope preserved, exit code still 0.
  it('reports success:false for a repo the token cannot see', async () => {
    const payload = await runCliJson<Failure>(['bb', 'repo', process.env.E2E_WORKSPACE!, 'e2e-nosuch-repo'], configDir)
    expect(payload.success).to.be.false

    const envelope = payload.error as {error?: {message?: string}}
    expect(envelope.error?.message, 'expected Bitbucket error envelope').to.be.a('string')
  })

  it('still lists workspaces for the default profile', async () => {
    const payload = await runCliJson<{data: {values: Array<{workspace: {slug: string}}>}; success: boolean}>(
      ['bb', 'workspace', 'list'],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.values.map((membership) => membership.workspace.slug)).to.include(process.env.E2E_WORKSPACE)
  })
})
