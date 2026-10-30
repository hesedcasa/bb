import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getBranch} from '../../../bitbucket/bitbucket-client.js'

export default class BranchGet extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    branch: Args.string({description: 'Branch name', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Get details of a specific branch'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo main',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo feature/x',
  ]

  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(BranchGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getBranch(auth, args.workspace, args.repoSlug, args.branch)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
