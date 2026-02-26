import {confirm, input} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'
import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

import {ApiResult} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default class AuthUpdate extends Command {
  static override args = {}
  static override description = 'Update existing authentication'
  static override enableJsonFlag = true
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    email: Flags.string({char: 'e', description: 'Account email', required: !process.stdout.isTTY}),
    token: Flags.string({char: 't', description: 'API Token', required: !process.stdout.isTTY}),
  }

  public async run(): Promise<ApiResult | void> {
    const {flags} = await this.parse(AuthUpdate)
    const configPath = path.join(this.config.configDir, 'bb-config.json')
    let config
    try {
      config = await fs.readJSON(configPath)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.toLowerCase().includes('no such file or directory')) {
        this.log('Run auth:add instead')
      } else {
        this.log(msg)
      }

      return
    }

    const apiToken =
      flags.token ??
      (await input({default: config.auth.apiToken, message: 'API Token:', prefill: 'tab', required: true}))
    const email =
      flags.email ??
      (await input({default: config.auth.email, message: 'Account email:', prefill: 'tab', required: true}))
    const answer = await confirm({message: 'Override existing config?'})

    if (!answer) {
      return
    }

    const auth = {
      auth: {
        apiToken,
        email,
      },
    }

    await fs.writeJSON(configPath, auth, {
      mode: 0o600, // owner read/write only
    })

    action.start('Authenticating')
    config = await fs.readJSON(configPath)
    const result = await testConnection(config.auth)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      this.log('Authentication updated successfully')
    } else {
      action.stop('✗ failed')
      this.error('Authentication is invalid. Please check your email, API Token, and URL.')
    }

    return result
  }
}
