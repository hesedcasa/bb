import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, listCommits} from '../../../bitbucket/bitbucket-client.js'

export default class CommitList extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'List commits for a repository, optionally restricted to a range'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --include feature-branch --exclude main',
  ]

  static override flags = {
    exclude: Flags.string({
      description: 'Exclude commits reachable from this SHA or branch (repeatable)',
      multiple: true,
      required: false,
    }),
    include: Flags.string({
      description: 'Include commits reachable from this SHA or branch (repeatable)',
      multiple: true,
      required: false,
    }),
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(CommitList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listCommits(
      auth,
      args.workspace,
      args.repoSlug,
      flags.page,
      flags.pagelen,
      flags.include,
      flags.exclude,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
