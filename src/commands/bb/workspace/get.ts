import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getWorkspace} from '../../../bitbucket/bitbucket-client.js'

export default class WorkspaceGet extends Command {
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
  }
  static override description = 'Get details of a specific workspace'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(WorkspaceGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getWorkspace(auth, args.workspace)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
