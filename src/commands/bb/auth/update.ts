import {confirm, input} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'
import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

import {ApiResult, type Config} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default class AuthUpdate extends Command {
  static override args = {}
  static override description = 'Update existing authentication profile'
  static override enableJsonFlag = true
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --profile work',
  ]
  static override flags = {
    email: Flags.string({char: 'e', description: 'Account email', required: false}),
    profile: Flags.string({char: 'p', description: 'Profile name to update (default: "default")', required: false}),
    token: Flags.string({char: 't', description: 'API Token', required: !process.stdout.isTTY}),
  }

  public async run(): Promise<ApiResult | void> {
    const {flags} = await this.parse(AuthUpdate)
    const profileName = flags.profile ?? 'default'
    const configFilePath = path.join(this.config.configDir, 'bb-config.json')

    let existing: Record<string, unknown>
    try {
      existing = await fs.readJSON(configFilePath)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.toLowerCase().includes('no such file or directory')) {
        this.log('Run auth:add instead')
      } else {
        this.log(msg)
      }

      return
    }

    // Migrate legacy {auth: {...}} into profiles.default, then read current profile
    const legacyAuth = existing.auth as Record<string, string> | undefined
    const profiles = (existing.profiles ?? (legacyAuth ? {default: legacyAuth} : {})) as Record<
      string,
      Record<string, string>
    >
    if (!profiles[profileName]) {
      this.error(`Profile '${profileName}' does not exist. Use auth:add to create it.`)
    }

    const current = profiles[profileName]

    const apiToken =
      flags.token ?? (await input({default: current.apiToken, message: 'API Token:', prefill: 'tab', required: true}))
    const email =
      flags.email ?? (await input({default: current.email, message: 'Account email:', prefill: 'tab', required: false}))
    const answer = await confirm({message: 'Override existing config?'})

    if (!answer) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {auth: _, ...rest} = existing
    const updatedConfig = {
      ...rest,
      profiles: {...profiles, [profileName]: {apiToken, ...(email && {email})}},
    }

    await fs.outputJSON(configFilePath, updatedConfig, {mode: 0o600})

    action.start('Authenticating')
    const result = await testConnection({apiToken, ...(email && {email})} as Config)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      const profileSuffix = profileName === 'default' ? '' : ` for profile '${profileName}'`
      this.log(`Authentication${profileSuffix} updated successfully`)
    } else {
      action.stop('✗ failed')
      this.error('Authentication is invalid. Please check your email, API Token, and URL.')
    }

    return result
  }
}
