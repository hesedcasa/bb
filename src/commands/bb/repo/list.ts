import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, listRepositories} from '../../../bitbucket/bitbucket-client.js'

export default class RepoList extends Command {
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
  }
  static override description = 'List repositories in a workspace'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    q: Flags.string({description: 'Query string to filter repositories', required: false}),
    role: Flags.string({description: 'Filter by role (admin, contributor, member, owner)', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listRepositories(auth, args.workspace, flags.page, flags.pagelen, flags.role, flags.q)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
