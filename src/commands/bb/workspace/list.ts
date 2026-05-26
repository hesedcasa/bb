import {Command, Flags} from '@oclif/core'

import {clearClients, listWorkspaces} from '../../../bitbucket/bitbucket-client.js'
import {formatAsToon} from '../../../format.js'
import {createProfileManager} from '@hesed/plugin-lib'

export default class WorkspaceList extends Command {
  static override args = {}
  static override description = 'List all accessible workspaces'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(WorkspaceList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const result = await listWorkspaces(auth, flags.page, flags.pagelen)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
