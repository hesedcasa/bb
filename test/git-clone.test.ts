/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'
import {Buffer} from 'node:buffer'
import {spawnSync} from 'node:child_process'
import {EventEmitter} from 'node:events'
import {existsSync} from 'node:fs'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {type SinonStub, stub} from 'sinon'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Wait until a condition holds, yielding to the event loop with real time
 * slices between tries so pending fs work (mkdtemp, rm) can complete.
 */
const until = async (condition: () => boolean, tries = 400): Promise<void> => {
  for (let i = 0; i < tries && !condition(); i++) {
    // eslint-disable-next-line no-await-in-loop -- deliberate poll with real time slices
    await sleep(5)
  }
}

/**
 * Fake spawnable child: an EventEmitter with pipe-shaped stdout/stderr that
 * understand setEncoding, mirroring what runGit wires up.
 */
function makeFakeChild(children: any[]): any {
  // eslint-disable-next-line unicorn/prefer-event-target -- a real child process is an EventEmitter
  const child: any = new EventEmitter()
  const stream = (): any => {
    // eslint-disable-next-line unicorn/prefer-event-target -- a real pipe stream is an EventEmitter
    const emitter: any = new EventEmitter()
    emitter.setEncoding = stub()
    return emitter
  }

  child.stdout = stream()
  child.stderr = stream()
  children.push(child)
  return child
}

describe('git-clone', () => {
  let cloneRepository: any
  let GitCloneError: any
  let buildAuthenticatedEnv: any
  let buildCredentialHelper: any
  let createRedactingStream: any
  let credentialSecrets: any
  let parseGitVersion: any
  let isGitVersionAtLeast: any
  let MINIMUM_GIT_VERSION: any
  let spawnStub: SinonStub
  let children: any[]
  let envSnapshot: NodeJS.ProcessEnv

  const url = 'https://bitbucket.org/ws/repo.git'
  const credentials = {host: 'bitbucket.org', password: 'super-secret-token', username: 'me@example.com'}

  const loadModule = async (): Promise<void> => {
    const mod = await esmock('../src/git-clone.js', {
      'node:child_process': {spawn: spawnStub},
    })
    cloneRepository = mod.cloneRepository
    GitCloneError = mod.GitCloneError
    buildAuthenticatedEnv = mod.buildAuthenticatedEnv
    buildCredentialHelper = mod.buildCredentialHelper
    createRedactingStream = mod.createRedactingStream
    credentialSecrets = mod.credentialSecrets
    parseGitVersion = mod.parseGitVersion
    isGitVersionAtLeast = mod.isGitVersionAtLeast
    MINIMUM_GIT_VERSION = mod.MINIMUM_GIT_VERSION
  }

  beforeEach(async () => {
    children = []
    spawnStub = stub()
    spawnStub.callsFake(() => makeFakeChild(children))
    envSnapshot = {...process.env}
    await loadModule()
  })

  afterEach(async () => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key]
      }
    }
  })

  describe('parseGitVersion', () => {
    it('parses plain version output', () => {
      expect(parseGitVersion('git version 2.39.5\n')).to.deep.equal({major: 2, minor: 39, patch: 5})
    })

    it('parses version output with a platform suffix', () => {
      expect(parseGitVersion('git version 2.24.3 (Apple Git-128)\n')).to.deep.equal({
        major: 2,
        minor: 24,
        patch: 3,
      })
    })

    it('parses two-component versions', () => {
      expect(parseGitVersion('git version 2.31\n')).to.deep.equal({major: 2, minor: 31, patch: 0})
    })

    it('returns undefined for unparseable output', () => {
      expect(parseGitVersion('not a version')).to.be.undefined
      expect(parseGitVersion('')).to.be.undefined
    })
  })

  describe('isGitVersionAtLeast', () => {
    it('accepts the exact minimum', () => {
      expect(isGitVersionAtLeast({major: 2, minor: 31, patch: 0}, MINIMUM_GIT_VERSION)).to.be.true
    })

    it('accepts newer versions', () => {
      expect(isGitVersionAtLeast({major: 2, minor: 39, patch: 5}, MINIMUM_GIT_VERSION)).to.be.true
      expect(isGitVersionAtLeast({major: 3, minor: 0, patch: 0}, MINIMUM_GIT_VERSION)).to.be.true
    })

    it('rejects older versions across every component', () => {
      expect(isGitVersionAtLeast({major: 2, minor: 30, patch: 9}, MINIMUM_GIT_VERSION)).to.be.false
      expect(isGitVersionAtLeast({major: 2, minor: 31, patch: 0}, {major: 2, minor: 31, patch: 1})).to.be.false
      expect(isGitVersionAtLeast({major: 1, minor: 99, patch: 99}, MINIMUM_GIT_VERSION)).to.be.false
    })
  })

  describe('buildCredentialHelper', () => {
    it('contains no secret material', () => {
      const helper = buildCredentialHelper(credentials.host)
      expect(helper).to.not.include(credentials.password)
      expect(helper).to.not.include(credentials.username)
      expect(helper).to.include(credentials.host)
    })
  })

  describe('buildAuthenticatedEnv', () => {
    it('delivers credentials only through dedicated child-env variables', () => {
      const env = buildAuthenticatedEnv(url, credentials, '/dev/null')

      expect(env.BB_GIT_USERNAME).to.equal(credentials.username)
      expect(env.BB_GIT_PASSWORD).to.equal(credentials.password)
      expect(env.BB_GIT_HOST).to.equal('bitbucket.org')
      // No secret anywhere in the git config values or the helper string.
      const configValues = [env.GIT_CONFIG_VALUE_0, env.GIT_CONFIG_VALUE_1]
      for (const value of configValues) {
        expect(value).to.not.include(credentials.password)
        expect(value).to.not.include(credentials.username)
      }
    })

    it('resets inherited helpers before installing the secret-free helper', () => {
      const env = buildAuthenticatedEnv(url, credentials, '/dev/null')

      expect(env.GIT_CONFIG_COUNT).to.equal('2')
      expect(env.GIT_CONFIG_KEY_0).to.equal('credential.helper')
      expect(env.GIT_CONFIG_VALUE_0).to.equal('')
      expect(env.GIT_CONFIG_KEY_1).to.equal('credential.helper')
      expect(env.GIT_CONFIG_VALUE_1).to.equal(buildCredentialHelper(credentials.host))
    })

    it('isolates the child from ambient git configuration', () => {
      const env = buildAuthenticatedEnv(url, credentials, '/dev/null')

      expect(env.GIT_CONFIG_GLOBAL).to.equal('/dev/null')
      expect(env.GIT_CONFIG_SYSTEM).to.equal('/dev/null')
      expect(env.GIT_CONFIG_NOSYSTEM).to.equal('1')
      expect(env.GIT_TERMINAL_PROMPT).to.equal('0')
    })

    it('excludes a hostile ambient environment', () => {
      process.env.GIT_ASKPASS = '/evil/askpass'
      process.env.GIT_TRACE = '1'
      process.env.GIT_CONFIG_COUNT = '9'
      process.env.GIT_CONFIG_KEY_0 = 'url.evil.example.insteadOf'
      process.env.GIT_CONFIG_VALUE_0 = 'https://evil.example/'
      process.env.SSH_AUTH_SOCK = '/evil/agent.sock'
      process.env.MY_SECRET_TOKEN = 'ambient-secret'
      process.env.HTTP_PROXY = 'http://proxy.local:3128'
      process.env.PATH = '/usr/bin:/bin'
      process.env.HOME = '/home/me'

      const env = buildAuthenticatedEnv(url, credentials, '/dev/null')

      expect(env.GIT_ASKPASS).to.be.undefined
      expect(env.GIT_TRACE).to.be.undefined
      expect(env.SSH_AUTH_SOCK).to.be.undefined
      expect(env.MY_SECRET_TOKEN).to.be.undefined
      // The hostile GIT_CONFIG_* block is replaced, not inherited.
      expect(env.GIT_CONFIG_COUNT).to.equal('2')
      expect(env.GIT_CONFIG_KEY_0).to.equal('credential.helper')
      expect(env.GIT_CONFIG_VALUE_0).to.equal('')
      // Operational allowlist entries survive.
      expect(env.HTTP_PROXY).to.equal('http://proxy.local:3128')
      expect(env.PATH).to.equal('/usr/bin:/bin')
      expect(env.HOME).to.equal('/home/me')
    })
  })

  describe('credentialSecrets', () => {
    it('returns the token raw, URL-encoded, and as a Basic-auth payload', () => {
      const secrets = credentialSecrets(credentials)
      expect(secrets).to.include(credentials.password)
      expect(secrets).to.include(encodeURIComponent(credentials.password))
      expect(secrets).to.include(Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64'))
    })
  })

  describe('createRedactingStream', () => {
    it('redacts secrets and passes plain text through', () => {
      const chunks: string[] = []
      const stream = createRedactingStream([credentials.password], (chunk: string) => {
        chunks.push(chunk)
      })

      stream.write(`Cloning into ${credentials.password}\n`)
      stream.end()

      expect(chunks.join('')).to.not.include(credentials.password)
      expect(chunks.join('')).to.include('[REDACTED]')
      expect(chunks.join('')).to.include('Cloning into')
    })

    it('catches a secret split across chunk boundaries', () => {
      const chunks: string[] = []
      const stream = createRedactingStream([credentials.password], (chunk: string) => {
        chunks.push(chunk)
      })
      const secret = credentials.password

      stream.write(`remote: token ${secret.slice(0, 8)}`)
      stream.write(secret.slice(8) + ' accepted\n')
      stream.end()

      const output = chunks.join('')
      expect(output).to.not.include(secret)
      expect(output).to.include('token [REDACTED] accepted')
    })

    it('redacts every secret variant including split Basic-auth payloads', () => {
      const secrets = credentialSecrets(credentials)
      const chunks: string[] = []
      const stream = createRedactingStream(secrets, (chunk: string) => {
        chunks.push(chunk)
      })
      const basic = secrets[2]

      stream.write(basic.slice(0, 6))
      stream.write(basic.slice(6))
      stream.write(' ' + encodeURIComponent(credentials.password).slice(0, 5))
      stream.write(encodeURIComponent(credentials.password).slice(5) + '\n')
      stream.end()

      const output = chunks.join('')
      for (const secret of secrets) {
        expect(output).to.not.include(secret)
      }
    })

    it('flushes a carried partial secret at end', () => {
      const chunks: string[] = []
      const stream = createRedactingStream([credentials.password], (chunk: string) => {
        chunks.push(chunk)
      })

      stream.write(credentials.password)
      stream.end()

      expect(chunks.join('')).to.not.include(credentials.password)
      expect(chunks.join('')).to.include('[REDACTED]')
    })

    it('handles empty secret lists as a passthrough', () => {
      const chunks: string[] = []
      const stream = createRedactingStream([], (chunk: string) => {
        chunks.push(chunk)
      })

      stream.write('plain\n')
      stream.end()

      expect(chunks.join('')).to.equal('plain\n')
    })
  })

  describe('cloneRepository (authenticated)', () => {
    const emitVersion = (version: string): void => {
      const child = children[0]
      child.stdout.emit('data', version)
      child.emit('close', 0, null)
    }

    it('checks the git version before cloning', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      expect(spawnStub.firstCall.args[1]).to.deep.equal(['--version'])
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 0, null)
      await promise

      expect(spawnStub.callCount).to.equal(2)
      expect(spawnStub.secondCall.args[1]).to.deep.equal(['clone', '--', url, path.resolve('/tmp/dest')])
    })

    it('rejects with a fixed message when git is too old and never clones', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.28.1 (Apple Git-125)\n')

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect(error).to.be.instanceOf(GitCloneError)
        expect((error as Error).message).to.equal(
          'Git 2.31 or newer is required for authenticated HTTPS cloning. Found Git 2.28.1.',
        )
      }

      expect(spawnStub.callCount).to.equal(1)
    })

    it('rejects with a fixed message when the git binary is missing', async () => {
      const missing = Object.assign(new Error('spawn git ENOENT'), {code: 'ENOENT'})
      spawnStub.callsFake(() => {
        throw missing
      })

      try {
        await cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal(
          'Git executable not found. Install Git and make sure it is available on your PATH.',
        )
      }

      expect(spawnStub.callCount).to.equal(1)
    })

    it('rejects when the version output cannot be parsed', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('some-other-tool 1.0\n')

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('Unable to determine the installed Git version.')
      }
    })

    it('spawns the clone with shell disabled from a temporary directory inside the OS temp dir', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 0, null)
      await promise

      const spawnOptions = spawnStub.secondCall.args[2]
      expect(spawnOptions.shell).to.equal(false)
      expect(spawnOptions.cwd.startsWith(tmpdir())).to.be.true
      expect(existsSync(spawnOptions.cwd)).to.be.false
    })

    it('passes an absolute destination even when given a relative one', async () => {
      const promise = cloneRepository({credentials, destination: 'sub/dir', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 0, null)
      await promise

      expect(spawnStub.secondCall.args[1]).to.deep.equal(['clone', '--', url, path.resolve(process.cwd(), 'sub/dir')])
    })

    it('delivers credentials through the child environment only, never argv', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 0, null)
      await promise

      const argv = JSON.stringify(spawnStub.secondCall.args.slice(0, 2))
      expect(argv).to.not.include(credentials.password)
      expect(argv).to.not.include(encodeURIComponent(credentials.password))
      expect(argv).to.not.include(Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64'))

      const {env} = spawnStub.secondCall.args[2]
      expect(env.BB_GIT_PASSWORD).to.equal(credentials.password)
      expect(env.GIT_CONFIG_VALUE_0).to.equal('')
      expect(env.GIT_CONFIG_VALUE_1).to.not.include(credentials.password)
    })

    it('redacts secret-bearing child output, including split chunks', async () => {
      const chunks: string[] = []
      const promise = cloneRepository({
        credentials,
        destination: '/tmp/dest',
        url,
        write(c: string) {
          chunks.push(c)
        },
      })
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)

      const secret = credentials.password
      children[1].stderr.emit('data', `remote: Invalid credentials for ${secret.slice(0, 9)}`)
      children[1].stderr.emit('data', `${secret.slice(9)} provided\n`)
      children[1].emit('close', 1, null)

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('git clone failed with exit code 1.')
      }

      const output = chunks.join('')
      expect(output).to.not.include(secret)
      expect(output).to.not.include(encodeURIComponent(secret))
      expect(output).to.include('[REDACTED]')
      expect(output).to.include('provided')
    })

    it('reports signal termination', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', null, 'SIGTERM')

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('git clone was terminated by signal SIGTERM.')
      }
    })

    it('settles once when an emitted error is followed by a trailing close', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('error', Object.assign(new Error('spawn aborted'), {code: 'ECONNRESET'}))
      children[1].emit('close', 2, null)

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('Failed to start git clone.')
      }

      expect(spawnStub.callCount).to.equal(2)
    })

    it('reports a non-zero close even when an error event fires afterwards', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 128, null)
      children[1].emit('error', Object.assign(new Error('late failure'), {code: 'ECONNRESET'}))

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('git clone failed with exit code 128.')
      }
    })

    it('removes the temporary working directory on clone failure', async () => {
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 128, null)

      try {
        await promise
        expect.fail('should have thrown')
      } catch {
        // expected failure
      }

      expect(existsSync(spawnStub.secondCall.args[2].cwd)).to.be.false
    })

    it('leaves the parent environment unchanged', async () => {
      const before = {...process.env}
      const promise = cloneRepository({credentials, destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      emitVersion('git version 2.39.5\n')
      await until(() => spawnStub.callCount === 2)
      children[1].emit('close', 0, null)
      await promise

      expect(process.env).to.deep.equal(before)
    })
  })

  describe('cloneRepository (plain https / ssh)', () => {
    it('invokes git exactly once with no version check and no credential injection', async () => {
      const sshUrl = 'git@bitbucket.org:ws/repo.git'
      const promise = cloneRepository({destination: '/tmp/dest', url: sshUrl, write() {}})
      await until(() => spawnStub.callCount === 1)
      expect(spawnStub.callCount).to.equal(1)
      children[0].emit('close', 0, null)
      await promise

      expect(spawnStub.firstCall.args[1]).to.deep.equal(['clone', '--', sshUrl, path.resolve('/tmp/dest')])
      const spawnOptions = spawnStub.firstCall.args[2]
      expect(spawnOptions.shell).to.equal(false)
      // Ordinary git behavior: inherit the caller's environment and cwd.
      expect(spawnOptions.env).to.be.undefined
      expect(spawnOptions.cwd).to.be.undefined
    })

    it('rejects with the ENOENT message when git is missing', async () => {
      const promise = cloneRepository({destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      children[0].emit('error', Object.assign(new Error('spawn git ENOENT'), {code: 'ENOENT'}))
      children[0].emit('close', null, null)

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal(
          'Git executable not found. Install Git and make sure it is available on your PATH.',
        )
      }
    })

    it('rejects on non-zero exit', async () => {
      const promise = cloneRepository({destination: '/tmp/dest', url, write() {}})
      await until(() => spawnStub.callCount === 1)
      children[0].emit('close', 1, null)

      try {
        await promise
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.equal('git clone failed with exit code 1.')
      }
    })
  })

  describe('credential helper semantics (real shell)', () => {
    before(function () {
      const probe = spawnSync('sh', ['-c', 'true'])
      if (probe.error) {
        this.skip()
      }
    })

    const runHelper = (helper: string, stdin: string): ReturnType<typeof spawnSync> =>
      spawnSync('sh', ['-c', helper], {
        env: {...process.env, BB_GIT_PASSWORD: credentials.password, BB_GIT_USERNAME: credentials.username},
        input: stdin,
      })

    it('answers get with the child-env credentials (old git: operation as argument)', () => {
      const helper = buildCredentialHelper('bitbucket.org')
      const result = spawnSync('sh', ['-c', helper, 'helper', 'get'], {
        env: {...process.env, BB_GIT_PASSWORD: credentials.password, BB_GIT_USERNAME: credentials.username},
        input: 'protocol=https\nhost=bitbucket.org\n\n',
      })

      expect(result.status).to.equal(0)
      expect(result.stdout.toString()).to.equal(`username=${credentials.username}\npassword=${credentials.password}\n`)
    })

    it('answers get with the child-env credentials (git >= 2.36: operation appended to script)', () => {
      const helper = buildCredentialHelper('bitbucket.org')
      const result = runHelper(`${helper} get`, 'protocol=https\nhost=bitbucket.org\n\n')

      expect(result.status).to.equal(0)
      expect(result.stdout.toString()).to.equal(`username=${credentials.username}\npassword=${credentials.password}\n`)
    })

    it('offers nothing for a different host', () => {
      const helper = buildCredentialHelper('bitbucket.org')
      const result = runHelper(helper, 'protocol=https\nhost=evil.example\n\n')

      expect(result.status).to.equal(0)
      expect(result.stdout.toString()).to.equal('')
    })

    it('reveals nothing when stdin carries no expected host line', () => {
      const helper = buildCredentialHelper('bitbucket.org')
      const result = runHelper(helper, 'protocol=https\n\n')

      expect(result.status).to.equal(0)
      expect(result.stdout.toString()).to.equal('')
    })
  })

  describe('local real-git regression', function () {
    // Real git against temporary local repositories: no network, no
    // credentials. Uses the real module (real spawn), not the esmock'd one.
    this.timeout(30_000)

    let originDir: string
    let workDir: string
    let realCloneRepository: any

    before(async () => {
      ;({cloneRepository: realCloneRepository} = await import('../src/git-clone.js'))
    })

    beforeEach(async () => {
      originDir = await mkdtemp(path.join(tmpdir(), 'bb-clone-origin-'))
      workDir = await mkdtemp(path.join(tmpdir(), 'bb-clone-work-'))

      const run = (args: string[], cwd: string): void => {
        const result = spawnSync('git', args, {
          cwd,
          env: {
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_AUTHOR_NAME: 'test',
            GIT_COMMITTER_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'test',
            HOME: process.env.HOME,
            PATH: process.env.PATH,
          },
        })
        if (result.status !== 0) {
          throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`)
        }
      }

      run(['init', '--initial-branch=main', '.'], originDir)
      await writeFile(path.join(originDir, 'README.md'), '# origin\n')
      run(['add', '.'], originDir)
      run(['commit', '-m', 'initial'], originDir)
    })

    afterEach(async () => {
      await rm(originDir, {force: true, recursive: true})
      await rm(workDir, {force: true, recursive: true})
    })

    it('clones a real local repository into the requested destination with a clean origin', async () => {
      const destination = path.join(workDir, 'my dest')
      await realCloneRepository({destination, url: originDir, write() {}})

      expect(existsSync(path.join(destination, 'README.md'))).to.be.true

      const config = spawnSync('git', ['config', '--get', 'remote.origin.url'], {cwd: destination})
      expect(config.status).to.equal(0)
      // The persisted remote is the clean URL — no credentials embedded.
      expect(config.stdout.toString().trim()).to.equal(originDir)
    })

    it('uses the explicit destination operand, including dash-prefixed names', async () => {
      // Destination starting with `-` must survive as a single operand; git
      // resolves it relative to the absolute path we hand it.
      const destination = path.join(workDir, '-dash-dir')
      await realCloneRepository({destination, url: originDir, write() {}})

      expect(existsSync(path.join(destination, '.git'))).to.be.true
    })

    it('fails without destroying the parent when the destination already exists', async () => {
      const destination = path.join(workDir, 'existing')
      spawnSync('git', ['init', destination])
      spawnSync('git', ['-C', destination, 'commit', '--allow-empty', '-m', 'x'])

      try {
        await realCloneRepository({destination, url: originDir, write() {}})
        expect.fail('should have thrown')
      } catch (error: unknown) {
        expect((error as Error).message).to.match(/git clone failed with exit code/)
      }

      // Git's own behavior decides what remains; the parent dir still exists.
      expect(existsSync(destination)).to.be.true
    })
  })
})
