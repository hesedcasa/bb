import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, listPullRequestCommits} from '../../../bitbucket/bitbucket-client.js'

export default class PrCommits extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    prId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'List commits on a pull request'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 42',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 42 --page 67Fg',
  ]
  static override flags = {
    // This endpoint pages by an opaque token from the previous response's `next` link, not by a page
    // number -- a numeric page is rejected with "Invalid page".
    page: Flags.string({description: 'Opaque page token from a previous response next link', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(PrCommits)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listPullRequestCommits(
      auth,
      args.workspace,
      args.repoSlug,
      args.prId,
      flags.pagelen,
      flags.page,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
