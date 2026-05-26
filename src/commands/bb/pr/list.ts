import {Args, Command, Flags} from '@oclif/core'

import {clearClients, listPullRequests} from '../../../bitbucket/bitbucket-client.js'
import {formatAsToon} from '../../../format.js'
import {createProfileManager} from '@hesed/plugin-lib'

export default class PrList extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'List pull requests for a repository'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    state: Flags.string({description: 'Filter by state (OPEN, MERGED, DECLINED, SUPERSEDED)', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const result = await listPullRequests(
      auth,
      args.workspace,
      args.repoSlug,
      flags.state,
      flags.page,
      flags.pagelen,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
