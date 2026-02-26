import {expect} from 'chai'
import fs from 'fs-extra'
import path from 'node:path'

import {readConfig} from '../src/config.js'

describe('config', () => {
  const testConfigDir = path.join(process.cwd(), 'test-config')
  const testConfigPath = path.join(testConfigDir, 'bb-config.json')

  // Setup and teardown
  beforeEach(async () => {
    // Create test config directory
    await fs.ensureDir(testConfigDir)
  })

  afterEach(async () => {
    // Clean up test config directory
    await fs.remove(testConfigDir)
  })

  describe('readConfig', () => {
    it('reads config file when it exists', async () => {
      const testConfig = {
        auth: {
          apiToken: 'test-token',
          email: 'test@example.com',
          host: 'https://bitbucket.org',
        },
      }

      await fs.writeJSON(testConfigPath, testConfig)

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

    it('reads config with all required fields', async () => {
      const testConfig = {
        auth: {
          apiToken: 'my-token',
          email: 'user@example.com',
          host: 'https://bitbucket.org',
        },
      }

      await fs.writeJSON(testConfigPath, testConfig)

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal(testConfig)
    })

    it('logs actual error message for non-ENOENT errors', async () => {
      // Make the config file unreadable by writing invalid content that causes a non-ENOENT error
      await fs.writeFile(testConfigPath, 'invalid json content {')

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.be.undefined
      expect(logMessages).to.have.lengthOf(1)
      // Should NOT say "Missing authentication config" since it's not a file-not-found error
      expect(logMessages[0]).to.not.include('Missing authentication config')
      // Should contain the actual JSON parse error message
      expect(logMessages[0].length).to.be.greaterThan(0)
    })

    it('handles config with additional fields', async () => {
      const testConfig = {
        auth: {
          apiToken: 'test-token',
          email: 'test@example.com',
          host: 'https://bitbucket.org',
        },
        extraField: 'some value',
      }

      await fs.writeJSON(testConfigPath, testConfig)

      const logMessages: string[] = []
      const result = await readConfig(testConfigDir, (msg) => logMessages.push(msg))

      expect(result).to.deep.equal(testConfig)
    })
  })
})
