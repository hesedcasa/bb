import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getWorkspace} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class WorkspaceGet extends Command {
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
  }
  static override description = 'Get details of a specific workspace'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(WorkspaceGet)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await getWorkspace(config.auth, args.workspace)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
