import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, listWorkspaces} from '../../../bitbucket/bitbucket-client.js'

export default class WorkspaceList extends BaseCommand {
  static override args = {}
  static override description = 'List all accessible workspaces'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {flags} = await this.parse(WorkspaceList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listWorkspaces(auth, flags.page, flags.pagelen)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
