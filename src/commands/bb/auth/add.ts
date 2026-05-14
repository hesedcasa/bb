import {input} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'
import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

import {ApiResult, type Config} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default class AuthAdd extends Command {
  static override args = {}
  static override description = 'Add Bitbucket authentication'
  static override enableJsonFlag = true
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --profile work',
  ]
  static override flags = {
    email: Flags.string({char: 'e', description: 'Account email', required: false}),
    profile: Flags.string({char: 'p', description: 'Profile name', required: false}),
    token: Flags.string({char: 't', description: 'API Token', required: !process.stdout.isTTY}),
  }

  public async run(): Promise<ApiResult> {
    const {flags} = await this.parse(AuthAdd)
    const profileName =
      flags.profile ?? (process.stdout.isTTY ? await input({message: 'Profile name:', required: true}) : 'default')
    const apiToken = flags.token ?? (await input({message: 'API Token:', required: true}))
    const email = flags.email ?? (await input({message: 'Account email:', required: false}))
    const configFilePath = path.join(this.config.configDir, 'bb-config.json')

    let existing: Record<string, unknown> = {}
    try {
      existing = await fs.readJSON(configFilePath)
    } catch {
      // file doesn't exist yet
    }

    const profiles = (existing.profiles ?? (existing.auth ? {default: existing.auth} : {})) as Record<string, unknown>

    if (profileName in profiles) {
      this.error(`Profile '${profileName}' already exists. Use 'bb auth update' to modify it.`)
    }

    profiles[profileName] = {apiToken, ...(email && {email})}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {auth: _auth, ...rest} = existing
    await fs.outputJSON(configFilePath, {...rest, profiles}, {mode: 0o600})

    action.start('Authenticating')
    const result = await testConnection({apiToken, ...(email && {email})} as Config)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      const profileSuffix = profileName === 'default' ? '' : ` as profile '${profileName}'`
      this.log(`Authentication added${profileSuffix} successfully`)
    } else {
      action.stop('✗ failed')
      this.error('Authentication is invalid. Please check your email, API Token, and URL.')
    }

    return result
  }
}
