/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {type SinonStub, stub} from 'sinon'

describe('repo:clone', () => {
  let RepoClone: any
  let createProfileManagerStub: SinonStub
  let getRepositoryStub: SinonStub
  let clearClientsStub: SinonStub
  let cloneRepositoryStub: SinonStub
  let manager: {getDefaultProfile: SinonStub; loadAuthConfig: SinonStub; readProfiles: SinonStub}

  const mockAuth = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://bitbucket.org',
  }

  const httpsHref = 'https://bitbucket.org/ws/repo.git'
  const sshHref = 'git@bitbucket.org:ws/repo.git'
  const mockResult = (cloneLinks: unknown[]): any => ({
    data: {links: {clone: cloneLinks}, slug: 'repo'},
    success: true,
  })

  const makeCommand = (argv: string[]): any => {
    const cmd = new RepoClone(argv, {
      root: process.cwd(),
      runHook: stub().resolves({failures: [], successes: []}),
    } as any)
    stub(cmd, 'log')
    stub(cmd, 'logJson')
    stub(cmd, 'warn')
    return cmd
  }

  /**
   * Run the command and assert the error boundary: exactly one sanitized
   * {error} JSON log, then an ExitError (oclif exit code 1).
   */
  const expectErrorExit = async (cmd: any, errorMatch: RegExp | string): Promise<any> => {
    let caught: unknown
    try {
      await cmd.run()
      expect.fail('should have thrown')
    } catch (error: unknown) {
      caught = error
    }

    const logged = (cmd.logJson as SinonStub).firstCall.args[0]
    expect(cmd.logJson.calledOnce).to.be.true
    expect(logged.error).to.be.a('string')
    if (typeof errorMatch === 'string') {
      expect(logged.error).to.equal(errorMatch)
    } else {
      expect(logged.error).to.match(errorMatch)
    }

    expect((caught as {code?: string}).code).to.equal('EEXIT')
    return logged
  }

  beforeEach(async () => {
    manager = {
      getDefaultProfile: stub().resolves('default'),
      loadAuthConfig: stub().resolves(mockAuth),
      readProfiles: stub().resolves({default: mockAuth}),
    }
    createProfileManagerStub = stub().returns(manager)
    getRepositoryStub = stub().resolves(mockResult([{href: httpsHref, name: 'https'}]))
    clearClientsStub = stub()
    cloneRepositoryStub = stub().resolves()

    const imported = await esmock('../../../../src/commands/bb/repo/clone.js', {
      '../../../../src/git-clone.js': {cloneRepository: cloneRepositoryStub},
      '../../../../src/bitbucket/bitbucket-client.js': {
        clearClients: clearClientsStub,
        getRepository: getRepositoryStub,
      },
      '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub},
    })
    RepoClone = imported.default
  })

  it('clones via the API https href into the slug directory by default', async () => {
    const cmd = makeCommand(['ws', 'repo'])
    await cmd.run()

    expect(createProfileManagerStub.calledWith(cmd.config, undefined, 'bb-config.json')).to.be.true
    expect(getRepositoryStub.calledOnceWith(mockAuth, 'ws', 'repo')).to.be.true
    expect(clearClientsStub.calledOnce).to.be.true
    expect(cloneRepositoryStub.calledOnce).to.be.true
    expect(cloneRepositoryStub.firstCall.args[0]).to.deep.equal({
      credentials: {host: 'bitbucket.org', password: 'test-token', username: 'test@example.com'},
      destination: `${process.cwd()}/repo`,
      url: httpsHref,
    })
    expect((cmd.log as SinonStub).calledOnceWith(`${process.cwd()}/repo`)).to.be.true
    expect((cmd.logJson as SinonStub).called).to.be.false
  })

  it('clones into a custom destination when given', async () => {
    const cmd = makeCommand(['ws', 'repo', 'my-dir'])
    await cmd.run()

    expect(cloneRepositoryStub.firstCall.args[0].destination).to.equal(`${process.cwd()}/my-dir`)
    expect((cmd.log as SinonStub).calledOnceWith(`${process.cwd()}/my-dir`)).to.be.true
  })

  it('selects the ssh href and performs no credential injection', async () => {
    getRepositoryStub.resolves(
      mockResult([
        {href: httpsHref, name: 'https'},
        {href: sshHref, name: 'ssh'},
      ]),
    )

    const cmd = makeCommand(['ws', 'repo', '--protocol', 'ssh'])
    await cmd.run()

    expect(getRepositoryStub.calledOnceWith(mockAuth, 'ws', 'repo')).to.be.true
    expect(cloneRepositoryStub.firstCall.args[0].url).to.equal(sshHref)
    expect(cloneRepositoryStub.firstCall.args[0].credentials).to.be.undefined
  })

  it('uses the profile for API discovery in ssh mode without credential injection', async () => {
    getRepositoryStub.resolves(mockResult([{href: sshHref, name: 'ssh'}]))

    const cmd = makeCommand(['-p', 'work', 'ws', 'repo', '--protocol', 'ssh'])
    await cmd.run()

    expect(createProfileManagerStub.calledWith(cmd.config, 'work', 'bb-config.json')).to.be.true
    expect(cloneRepositoryStub.firstCall.args[0].credentials).to.be.undefined
  })

  it('selects a named profile with -p', async () => {
    const cmd = makeCommand(['-p', 'work', 'ws', 'repo'])
    await cmd.run()

    expect(createProfileManagerStub.calledWith(cmd.config, 'work', 'bb-config.json')).to.be.true
    expect(cloneRepositoryStub.firstCall.args[0].credentials).to.deep.equal({
      host: 'bitbucket.org',
      password: 'test-token',
      username: 'test@example.com',
    })
  })

  it('fails with the standard error JSON for an unknown profile', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.resolves({default: mockAuth})

    const cmd = makeCommand(['-p', 'nope', 'ws', 'repo'])
    await expectErrorExit(cmd, "Profile 'nope' not found in authentication config.")

    expect(getRepositoryStub.called).to.be.false
    expect(cloneRepositoryStub.called).to.be.false
    expect(clearClientsStub.called).to.be.false
  })

  it('warns on stderr and clones anonymously when no default profile is configured', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.rejects(new Error('No authentication profiles found'))

    const cmd = makeCommand(['ws', 'repo'])
    await cmd.run()

    expect((cmd.warn as SinonStub).calledOnce).to.be.true
    expect(getRepositoryStub.calledOnceWith(undefined, 'ws', 'repo')).to.be.true
    expect(cloneRepositoryStub.firstCall.args[0].credentials).to.be.undefined
    expect((cmd.log as SinonStub).calledOnceWith(`${process.cwd()}/repo`)).to.be.true
  })

  it('warns and clones anonymously when the config has no default profile entry', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.resolves({work: mockAuth})
    manager.getDefaultProfile.resolves('default')

    const cmd = makeCommand(['ws', 'repo'])
    await cmd.run()

    expect((cmd.warn as SinonStub).calledOnce).to.be.true
    expect(getRepositoryStub.calledOnceWith(undefined, 'ws', 'repo')).to.be.true
    expect(cloneRepositoryStub.calledOnce).to.be.true
  })

  it('does not warn on the ssh path when no profile is configured', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.rejects(new Error('No authentication profiles found'))
    getRepositoryStub.resolves(mockResult([{href: sshHref, name: 'ssh'}]))

    const cmd = makeCommand(['ws', 'repo', '--protocol', 'ssh'])
    await cmd.run()

    expect((cmd.warn as SinonStub).called).to.be.false
    expect(cloneRepositoryStub.firstCall.args[0].credentials).to.be.undefined
  })

  it('treats a corrupt auth config as an error, not an anonymous fallback', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.rejects(new SyntaxError('Unexpected token } in JSON'))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, 'Authentication config exists but could not be loaded.')

    expect(getRepositoryStub.called).to.be.false
    expect(cloneRepositoryStub.called).to.be.false
  })

  it('treats failed secret resolution as an error', async () => {
    manager.loadAuthConfig.resolves(undefined)
    manager.readProfiles.resolves({default: mockAuth})
    manager.getDefaultProfile.resolves('default')

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, 'Authentication config exists but could not be loaded.')

    expect(getRepositoryStub.called).to.be.false
  })

  it('emits a stable error and never invokes git when the API lookup fails', async () => {
    getRepositoryStub.resolves({error: {message: 'secret stuff'}, success: false})

    const cmd = makeCommand(['ws', 'missing'])
    await expectErrorExit(
      cmd,
      'Failed to look up repository ws/missing. Check the workspace, repository slug, and your credentials.',
    )

    expect((cmd.logJson as SinonStub).firstCall.args[0].error).to.not.include('secret stuff')
    expect(cloneRepositoryStub.called).to.be.false
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('still clears clients when the API lookup throws', async () => {
    getRepositoryStub.rejects(new Error('network down'))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, /network down/)

    expect(clearClientsStub.calledOnce).to.be.true
    expect(cloneRepositoryStub.called).to.be.false
  })

  it('rejects a repository response without clone links', async () => {
    getRepositoryStub.resolves({data: {slug: 'repo'}, success: true})

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, 'Repository lookup returned no clone links.')

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('rejects a missing entry for the selected protocol', async () => {
    getRepositoryStub.resolves(mockResult([{href: sshHref, name: 'ssh'}]))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, 'Repository lookup returned no https clone URL.')

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('strips API-supplied username userinfo from the https href', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'https://apiuser@bitbucket.org/ws/repo.git', name: 'https'}]))

    const cmd = makeCommand(['ws', 'repo'])
    await cmd.run()

    expect(cloneRepositoryStub.firstCall.args[0].url).to.equal('https://bitbucket.org/ws/repo.git')
  })

  it('rejects an https href carrying a password', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'https://user:pw@bitbucket.org/ws/repo.git', name: 'https'}]))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, 'The repository https clone URL unexpectedly contains a password.')

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('rejects a non-bitbucket https host', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'https://evil.example/ws/repo.git', name: 'https'}]))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, /unexpected host 'evil\.example'/)

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('rejects an https href with query or fragment', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'https://bitbucket.org/ws/repo.git?x=1', name: 'https'}]))

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, /query or fragment/)

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('accepts an ssh:// style href', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'ssh://git@bitbucket.org/ws/repo.git', name: 'ssh'}]))

    const cmd = makeCommand(['ws', 'repo', '--protocol', 'ssh'])
    await cmd.run()

    expect(cloneRepositoryStub.firstCall.args[0].url).to.equal('ssh://git@bitbucket.org/ws/repo.git')
  })

  it('rejects a non-bitbucket ssh host', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'git@evil.example:ws/repo.git', name: 'ssh'}]))

    const cmd = makeCommand(['ws', 'repo', '--protocol', 'ssh'])
    await expectErrorExit(cmd, /not a valid Bitbucket ssh URL/)

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('rejects option-like or helper-syntax ssh hrefs', async () => {
    getRepositoryStub.resolves(mockResult([{href: 'ext::sh -c git clone', name: 'ssh'}]))

    const cmd = makeCommand(['ws', 'repo', '--protocol', 'ssh'])
    await expectErrorExit(cmd, /not a valid Bitbucket ssh URL/)

    expect(cloneRepositoryStub.called).to.be.false
  })

  it('surfaces a git failure once as sanitized {error} JSON with exit 1 and no success log', async () => {
    cloneRepositoryStub.rejects(new Error('git clone failed with exit code 128.'))

    const cmd = makeCommand(['ws', 'repo'])
    const logged = await expectErrorExit(cmd, 'git clone failed with exit code 128.')

    expect(logged.error).to.not.include('test-token')
    expect((cmd.log as SinonStub).called).to.be.false
    expect(clearClientsStub.calledOnce).to.be.true
  })

  it('redacts the profile token if an unexpected error leaks it', async () => {
    getRepositoryStub.rejects(new Error('boom test-token boom'))

    const cmd = makeCommand(['ws', 'repo'])
    const logged = await expectErrorExit(cmd, /boom \[REDACTED\] boom/)

    expect(logged.error).to.not.include('test-token')
  })

  it('surfaces a missing email as an error before any git call', async () => {
    manager.loadAuthConfig.resolves({apiToken: 'test-token'})

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, /has no email address/)

    expect(getRepositoryStub.called).to.be.false
    expect(cloneRepositoryStub.called).to.be.false
  })

  it('surfaces a missing token as an error before any git call', async () => {
    manager.loadAuthConfig.resolves({email: 'test@example.com'})

    const cmd = makeCommand(['ws', 'repo'])
    await expectErrorExit(cmd, /has no API token/)

    expect(getRepositoryStub.called).to.be.false
    expect(cloneRepositoryStub.called).to.be.false
  })

  it('covers parser errors with the same sanitized boundary', async () => {
    const cmd = makeCommand([])
    const logged = await expectErrorExit(cmd, /Missing/)

    expect(logged.error).to.be.a('string')
    expect(cloneRepositoryStub.called).to.be.false
  })
})
