import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, mergePullRequest} from '../../../bitbucket/bitbucket-client.js'

export default class PrMerge extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pullRequestId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Merge a pull request'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo 123']
  static override flags = {
    'close-source-branch': Flags.boolean({
      default: false,
      description: 'Close source branch after merge',
      required: false,
    }),
    message: Flags.string({char: 'm', description: 'Merge commit message', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    strategy: Flags.string({
      description: 'Merge strategy (merge_commit, squash, fast_forward)',
      options: ['merge_commit', 'squash', 'fast_forward'],
      required: false,
    }),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrMerge)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await mergePullRequest(
      auth,
      args.workspace,
      args.repoSlug,
      args.pullRequestId,
      flags.strategy,
      flags['close-source-branch'],
      flags.message,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
