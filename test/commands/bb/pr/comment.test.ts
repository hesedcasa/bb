/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {type SinonStub, stub} from 'sinon'

describe('pr:comment', () => {
  let PrComment: any
  let createProfileManagerStub: SinonStub
  let createPullRequestCommentStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {content: {raw: 'Nice work'}, id: 1}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    createPullRequestCommentStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/comment.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        createPullRequestComment: createPullRequestCommentStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrComment = imported.default
  })

  it('posts a general comment and outputs JSON', async () => {
    const cmd = new PrComment(['my-ws', 'my-repo', '42', '--body', 'Nice work'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createPullRequestCommentStub.calledOnce).to.be.true
    expect(createPullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      'Nice work',
      undefined,
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('posts an inline comment with --file and --line', async () => {
    const cmd = new PrComment(
      ['my-ws', 'my-repo', '42', '--body', 'Fix this', '--file', 'src/foo.ts', '--line', '15'],
      {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any,
    )

    const result = await cmd.run()

    expect(createPullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      'Fix this',
      {line: 15, path: 'src/foo.ts'},
    ])
    expect(result).to.deep.equal(mockResult)
  })

  it('errors when --file is given without --line', async () => {
    const cmd = new PrComment(['my-ws', 'my-repo', '42', '--body', 'oops', '--file', 'src/foo.ts'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('--file and --line must be used together')
    }

    expect(createPullRequestCommentStub.called).to.be.false
  })

  it('errors when --line is given without --file', async () => {
    const cmd = new PrComment(['my-ws', 'my-repo', '42', '--body', 'oops', '--line', '5'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: any) {
      expect(error.message).to.include('--file and --line must be used together')
    }

    expect(createPullRequestCommentStub.called).to.be.false
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrComment(['my-ws', 'my-repo', '42', '--body', 'hi'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(createPullRequestCommentStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrComment(['my-ws', 'my-repo', '42', '--body', 'Nice work', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(formatAsToonStub.calledOnceWith(mockResult)).to.be.true
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

    it('reads an @<path> --body from the file verbatim', async () => {
      await new PrComment(['my-ws', 'my-repo', '42', '--body', `@${file}`], {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any).run()

      expect(createPullRequestCommentStub.firstCall.args[4]).to.equal('line one\\nstill line one\nline two')
    })

    it('keeps a literal leading @ escaped as @@', async () => {
      await new PrComment(['my-ws', 'my-repo', '42', '--body', '@@dev please look'], {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any).run()

      expect(createPullRequestCommentStub.firstCall.args[4]).to.equal('@dev please look')
    })
  })
})
