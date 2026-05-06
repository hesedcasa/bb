import {input} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'
import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

import {ApiResult} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default class AuthAdd extends Command {
  static override args = {}
  static override description = 'Add Bitbucket authentication'
  static override enableJsonFlag = true
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    email: Flags.string({char: 'e', description: 'Account email:', required: false}),
    profile: Flags.string({char: 'p', default: 'default', description: 'Profile name', required: false}),
    token: Flags.string({char: 't', description: 'API Token:', required: !process.stdout.isTTY}),
  }

  public async run(): Promise<ApiResult> {
    const {flags} = await this.parse(AuthAdd)
    const profileName = flags.profile

    const apiToken = flags.token ?? (await input({message: 'API Token:', required: true}))
    const email = flags.email ?? (await input({message: 'Account email:', required: false}))
    const configPath = path.join(this.config.configDir, 'bb-config.json')

    // Read existing config to preserve other profiles
    let existingProfiles: Record<string, unknown> = {}
    try {
      const raw = await fs.readJSON(configPath)
      if (raw.profiles) {
        existingProfiles = raw.profiles as Record<string, unknown>
      } else if (raw.auth) {
        existingProfiles = {default: raw.auth}
      }
    } catch {
      // File doesn't exist or is invalid — start fresh
    }

    const profileData = {
      apiToken,
      ...(email && {email}),
    }
    const config = {profiles: {...existingProfiles, [profileName]: profileData}}

    const exists = await fs.pathExists(configPath)
    if (!exists) {
      await fs.createFile(configPath)
    }

    await fs.writeJSON(configPath, config, {
      mode: 0o600,
    })

    action.start('Authenticating')
    const result = await testConnection(profileData)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      this.log(`Authentication added successfully${profileName !== 'default' ? ` (profile: ${profileName})` : ''}`)
    } else {
      action.stop('✗ failed')
      this.error('Authentication is invalid. Please check your email, API Token, and URL.')
    }

    return result
  }
}
