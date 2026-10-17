/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {type SinonStub, stub} from 'sinon'

describe('pr:comment-update', () => {
  let PrCommentUpdate: any
  let createProfileManagerStub: SinonStub
  let updatePullRequestCommentStub: SinonStub
  let clearClientsStub: SinonStub
  let formatAsToonStub: SinonStub

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const mockResult = {data: {content: {raw: 'Updated text'}, id: 100}, success: true}

  beforeEach(async () => {
    createProfileManagerStub = stub().returns({loadAuthConfig: stub().resolves(mockAuth)})
    updatePullRequestCommentStub = stub().resolves(mockResult)
    clearClientsStub = stub()
    formatAsToonStub = stub().returns('toon-output')

    const imported = await esmock('../../../../src/commands/bb/pr/comment-update.js', {
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        updatePullRequestComment: updatePullRequestCommentStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
    })
    PrCommentUpdate = imported.default
  })

  it('calls updatePullRequestComment with correct args and outputs JSON', async () => {
    const cmd = new PrCommentUpdate(['my-ws', 'my-repo', '42', '100', '--body', 'Updated text'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    const result = await cmd.run()

    expect(createProfileManagerStub.calledOnce).to.be.true
    expect(updatePullRequestCommentStub.calledOnce).to.be.true
    expect(updatePullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      100,
      'Updated text',
    ])
    expect(clearClientsStub.calledOnce).to.be.true
    expect(result).to.deep.equal(mockResult)
  })

  it('returns early when config is missing', async () => {
    createProfileManagerStub.returns({loadAuthConfig: stub().resolves(null)})

    const cmd = new PrCommentUpdate(['my-ws', 'my-repo', '42', '100', '--body', 'hi'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)

    try {
      await cmd.run()
    } catch {
      // expected error when config is missing
    }

    expect(updatePullRequestCommentStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('outputs TOON format when --toon flag is used', async () => {
    const cmd = new PrCommentUpdate(['my-ws', 'my-repo', '42', '100', '--body', 'Updated text', '--toon'], {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    const logStub = stub(cmd, 'log')

    await cmd.run()

    expect(updatePullRequestCommentStub.firstCall.args).to.deep.equal([
      mockAuth,
      'my-ws',
      'my-repo',
      42,
      100,
      'Updated text',
    ])
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
      await new PrCommentUpdate(['my-ws', 'my-repo', '42', '100', '--body', `@${file}`], {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any).run()

      expect(updatePullRequestCommentStub.firstCall.args[5]).to.equal('line one\\nstill line one\nline two')
    })

    it('keeps a literal leading @ escaped as @@', async () => {
      await new PrCommentUpdate(['my-ws', 'my-repo', '42', '100', '--body', '@@dev please look'], {
        root: process.cwd(),
        runHook: stub().resolves({failures: [], successes: []}),
      } as any).run()

      expect(updatePullRequestCommentStub.firstCall.args[5]).to.equal('@dev please look')
    })
  })
})
