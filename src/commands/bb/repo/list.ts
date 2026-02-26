import {Args, Command, Flags} from '@oclif/core'

import {clearClients, listRepositories} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class RepoList extends Command {
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
  }
  static override description = 'List repositories in a workspace'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    q: Flags.string({description: 'Query string to filter repositories', required: false}),
    role: Flags.string({description: 'Filter by role (admin, contributor, member, owner)', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoList)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await listRepositories(config.auth, args.workspace, flags.page, flags.pagelen, flags.role, flags.q)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
