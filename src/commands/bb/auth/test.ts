import {Command} from '@oclif/core'
import {action} from '@oclif/core/ux'

import {ApiResult} from '../../../bitbucket/bitbucket-api.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'

export default class AuthTest extends Command {
  static override args = {}
  static override description = 'Test authentication and connection'
  static override enableJsonFlag = true
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {}

  public async run(): Promise<ApiResult> {
    await this.parse(AuthTest)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return {
        error: 'Missing authentication config',
        success: false,
      }
    }

    action.start('Authenticating connection')
    const result = await testConnection(config.auth)
    clearClients()

    if (result.success) {
      action.stop('✓ successful')
      this.log('Successful connection to Bitbucket')
    } else {
      action.stop('✗ failed')
      this.error('Failed to connect to Bitbucket.')
    }

    return result
  }
}
