/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {type SinonStub, stub} from 'sinon'

describe('pr:create', () => {
  let PrCreate: any
  let createProfileManagerStub: SinonStub
  let createPullRequestStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {id: 1, title: 'My PR'}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    createPullRequestStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/create.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        createPullRequest: createPullRequestStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrCreate = imported.default
  })

  it('calls createPullRequest with correct args and outputs JSON', async () => {
    const cmd = new PrCreate(['my-ws', 'my-repo', '--title', 'My PR', '--source', 'feature', '--destination', 'main'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(createPullRequestStub.calledOnce).to.be.true
    expect(createPullRequestStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      'My PR',
      'feature',
      'main',
      undefined,
      undefined,
      true,
      false,
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('passes optional flags correctly', async () => {
    const cmd = new PrCreate(
      [
        'my-ws',
        'my-repo',
        '--title',
        'My PR',
        '--source',
        'feature',
        '--destination',
        'main',
        '--description',
        'A description',
        '--reviewers',
        'uuid1, uuid2, uuid3',
      ],
      {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any,
    )

    await cmd.run()

    expect(createPullRequestStub.calledOnce).to.be.true
    expect(createPullRequestStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      'My PR',
      'feature',
      'main',
      'A description',
      ['uuid1', 'uuid2', 'uuid3'],
      true,
      false,
    ])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('passes --draft as draft=true', async () => {
    const cmd = new PrCreate(
      ['my-ws', 'my-repo', '--title', 'My PR', '--source', 'feature', '--destination', 'main', '--draft'],
      {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any,
    )

    await cmd.run()

    expect(createPullRequestStub.calledOnce).to.be.true
    expect(createPullRequestStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      'My PR',
      'feature',
      'main',
      undefined,
      undefined,
      true,
      true,
    ])
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrCreate(['my-ws', 'my-repo', '--title', 'My PR', '--source', 'feature', '--destination', 'main'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(createPullRequestStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrCreate(
      ['my-ws', 'my-repo', '--title', 'My PR', '--source', 'feature', '--destination', 'main', '--toon'],
      {root: process.cwd(), runHook: stub().resolves({failures: [], successes: []})} as any,
    )
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(createPullRequestStub.calledOnce).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(formatAsToonStub.calledOnce).to.be.true
    expect(formatAsToonStub.firstCall.args[0]).to.deep.equal(mockResult)
    expect(logStub.calledWith('toon-output')).to.be.true
  })

  describe('file input', () => {
    let dir: string
    let file: string

    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'bb-file-input-'))
      file = path.join(dir, 'text.md')
      writeFileSync(file, 'line one\\nstill line one\nline two')
    })

    afterEach(() => {
      rmSync(dir, {force: true, recursive: true})
    })

    it(String.raw`reads an @<path> --description verbatim, without unescaping \n`, async () => {
      await new PrCreate(
        ['my-ws', 'my-repo', '--title', 'T', '--source', 'feat', '--destination', 'main', '--description', `@${file}`],
        {
          root: process.cwd(),
          runHook: stub().resolves({failures: [], successes: []}),
        } as any,
      ).run()

      expect(createPullRequestStub.firstCall.args[6]).to.equal('line one\\nstill line one\nline two')
    })

    it(String.raw`still unescapes \n in an inline --description`, async () => {
      await new PrCreate(
        [
          'my-ws',
          'my-repo',
          '--title',
          'T',
          '--source',
          'feat',
          '--destination',
          'main',
          '--description',
          String.raw`a\nb`,
        ],
        {
          root: process.cwd(),
          runHook: stub().resolves({failures: [], successes: []}),
        } as any,
      ).run()

      expect(createPullRequestStub.firstCall.args[6]).to.equal('a\nb')
    })
  })
})
