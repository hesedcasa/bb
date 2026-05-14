import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'

import {getDefaultProfile, readConfig, readProfiles, setDefaultProfile} from '../src/config.js'

describe('config', () => {
  const testConfigDir = path.join(process.cwd(), 'test-config')
  const testConfigPath = path.join(testConfigDir, 'bb-config.json')

  beforeEach(async () => {
    await fs.ensureDir(testConfigDir)
  })

  afterEach(async () => {
    await fs.remove(testConfigDir)
  })

  describe('readConfig', () => {
    it('reads old-format config file (backward compat)', async () => {
      const testConfig = {
        auth: {
          apiToken: 'test-token',
          email: 'test@example.com',
          host: 'https://bitbucket.org',
        },
      }

      await fs.outputJSON(testConfigPath, testConfig)

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal(testConfig)
      expect(logMessages).to.be.empty
    })

    it('returns undefined when config file does not exist', async () => {
      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.be.undefined
      expect(logMessages).to.include('Missing authentication config')
    })

    it('logs error message when config file is invalid JSON', async () => {
      await fs.writeFile(testConfigPath, 'invalid json content {')

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.be.undefined
      expect(logMessages).to.have.length.greaterThan(0)
      expect(logMessages[0]).to.not.equal('Missing authentication config')
    })

    it('reads profiles config with default profile', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {
            apiToken: 'default-token',
            email: 'default@example.com',
            host: 'https://bitbucket.org',
          },
          work: {
            apiToken: 'work-token',
            email: 'work@example.com',
            host: 'https://bitbucket.org',
          },
        },
      })

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal({
        auth: {
          apiToken: 'default-token',
          email: 'default@example.com',
          host: 'https://bitbucket.org',
        },
      })
    })

    it('reads profiles config with explicit profile name', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {
            apiToken: 'default-token',
            email: 'default@example.com',
            host: 'https://bitbucket.org',
          },
          work: {
            apiToken: 'work-token',
            email: 'work@example.com',
            host: 'https://bitbucket.org',
          },
        },
      })

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg), 'work')

      expect(result).to.deep.equal({
        auth: {
          apiToken: 'work-token',
          email: 'work@example.com',
          host: 'https://bitbucket.org',
        },
      })
    })

    it('returns undefined for non-existent profile', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {
            apiToken: 'token',
            email: 'a@b.com',
            host: 'https://bitbucket.org',
          },
        },
      })

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg), 'missing')

      expect(result).to.be.undefined
      expect(logMessages).to.include("Profile 'missing' not found")
    })

    it('returns undefined for non-default profile on old-format config', async () => {
      await fs.outputJSON(testConfigPath, {
        auth: {
          apiToken: 'token',
          email: 'a@b.com',
          host: 'https://bitbucket.org',
        },
      })

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg), 'work')

      expect(result).to.be.undefined
      expect(logMessages).to.include("Profile 'work' not found")
    })

    it('respects defaultProfile in config file when no profile arg given', async () => {
      await fs.outputJSON(testConfigPath, {
        defaultProfile: 'staging',
        profiles: {
          default: {
            apiToken: 'default-token',
            email: 'default@example.com',
            host: 'https://bitbucket.org',
          },
          staging: {
            apiToken: 'staging-token',
            email: 'staging@example.com',
            host: 'https://bitbucket.org',
          },
        },
      })

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal({
        auth: {
          apiToken: 'staging-token',
          email: 'staging@example.com',
          host: 'https://bitbucket.org',
        },
      })
    })

    it('logs actual error message for non-ENOENT errors', async () => {
      await fs.writeFile(testConfigPath, 'invalid json content {')

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.be.undefined
      expect(logMessages).to.have.lengthOf(1)
      expect(logMessages[0]).to.not.include('Missing authentication config')
      expect(logMessages[0].length).to.be.greaterThan(0)
    })
  })

  describe('readProfiles', () => {
    it('reads profiles from config', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {
            apiToken: 'token1',
            email: 'a@b.com',
            host: 'https://bitbucket.org',
          },
          work: {
            apiToken: 'token2',
            email: 'c@d.com',
            host: 'https://bitbucket.org',
          },
        },
      })

      const logMessages: string[] = []
      const result = await readProfiles(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal({
        default: {apiToken: 'token1', email: 'a@b.com', host: 'https://bitbucket.org'},
        work: {apiToken: 'token2', email: 'c@d.com', host: 'https://bitbucket.org'},
      })
    })

    it('converts old-format config to default profile', async () => {
      await fs.outputJSON(testConfigPath, {
        auth: {
          apiToken: 'token',
          email: 'test@example.com',
          host: 'https://bitbucket.org',
        },
      })

      const logMessages: string[] = []
      const result = await readProfiles(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal({
        default: {apiToken: 'token', email: 'test@example.com', host: 'https://bitbucket.org'},
      })
    })

    it('returns undefined when no config file exists', async () => {
      const logMessages: string[] = []
      const result = await readProfiles(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.be.undefined
      expect(logMessages).to.include('No authentication profiles found')
    })
  })

  describe('getDefaultProfile', () => {
    it('returns "default" when config file does not exist', async () => {
      const result = await getDefaultProfile(testConfigDir)
      expect(result).to.equal('default')
    })

    it('returns profile name from defaultProfile field in config', async () => {
      await fs.outputJSON(testConfigPath, {
        defaultProfile: 'work',
        profiles: {
          default: {apiToken: 'token', host: 'https://bitbucket.org'},
          work: {apiToken: 'token2', host: 'https://bitbucket.org'},
        },
      })

      const result = await getDefaultProfile(testConfigDir)
      expect(result).to.equal('work')
    })

    it('returns "default" when defaultProfile field is missing', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {apiToken: 'token', host: 'https://bitbucket.org'},
        },
      })

      const result = await getDefaultProfile(testConfigDir)
      expect(result).to.equal('default')
    })
  })

  describe('setDefaultProfile', () => {
    it('sets the default profile in config file', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {apiToken: 'token', host: 'https://bitbucket.org'},
          work: {apiToken: 'token2', host: 'https://bitbucket.org'},
        },
      })

      const logMessages: string[] = []
      await setDefaultProfile(testConfigDir, 'work', (msg) => logMessages.push(msg))

      const defaultProfile = await getDefaultProfile(testConfigDir)
      expect(defaultProfile).to.equal('work')
      expect(logMessages).to.include("Default profile set to 'work'")

      const raw = await fs.readJSON(testConfigPath)
      expect(raw.defaultProfile).to.equal('work')
    })

    it('logs error for non-existent profile', async () => {
      await fs.outputJSON(testConfigPath, {
        profiles: {
          default: {apiToken: 'token', host: 'https://bitbucket.org'},
        },
      })

      const logMessages: string[] = []
      await setDefaultProfile(testConfigDir, 'missing', (msg) => logMessages.push(msg))

      expect(logMessages).to.include("Profile 'missing' not found")
    })
  })
})
