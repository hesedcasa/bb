import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, listBranches} from '../../../bitbucket/bitbucket-client.js'

export default class BranchList extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = "List a repository's branches"
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --pagelen 25 --page 2',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --sort name --q \'name ~ "feature/x"\'',
  ]

  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    q: Flags.string({description: 'Bitbucket query string to filter branches, e.g. name ~ "feature/x"', required: false}),
    sort: Flags.string({description: 'Field to sort by, e.g. name (prefix with - to reverse)', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(BranchList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listBranches(auth, args.workspace, args.repoSlug, {
      page: flags.page,
      pagelen: flags.pagelen,
      q: flags.q,
      sort: flags.sort,
    })
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
