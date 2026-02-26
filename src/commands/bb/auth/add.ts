import {input} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'
import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

import {ApiResult} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default class AuthAdd extends Command {
  static override args = {}
  static override description = 'Add Atlassian authentication'
  static override enableJsonFlag = true
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    email: Flags.string({char: 'e', description: 'Account email:', required: !process.stdout.isTTY}),
    token: Flags.string({char: 't', description: 'API Token:', required: !process.stdout.isTTY}),
  }

  public async run(): Promise<ApiResult> {
    const {flags} = await this.parse(AuthAdd)

    const apiToken = flags.token ?? (await input({message: 'API Token:', required: true}))
    const email = flags.email ?? (await input({message: 'Account email:', required: true}))
    const configPath = path.join(this.config.configDir, 'bb-config.json')
    const auth = {
      auth: {
        apiToken,
        email,
      },
    }

    const exists = await fs.pathExists(configPath)

    if (!exists) {
      await fs.createFile(configPath)
    }

    await fs.writeJSON(configPath, auth, {
      mode: 0o600, // owner read/write only
    })

    action.start('Authenticating')
    const config = await fs.readJSON(configPath)
    const result = await testConnection(config.auth)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      this.log('Authentication added successfully')
    } else {
      action.stop('✗ failed')
      this.error('Authentication is invalid. Please check your email, API Token, and URL.')
    }

    return result
  }
}
