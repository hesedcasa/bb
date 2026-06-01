import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, resolvePullRequestComment} from '../../../bitbucket/bitbucket-client.js'

export default class PrCommentResolve extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    prId: Args.integer({description: 'Pull request ID', required: true}),
    commentId: Args.integer({description: 'Comment ID to resolve', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Resolve a comment on a pull request'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo 42 100']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrCommentResolve)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await resolvePullRequestComment(auth, args.workspace, args.repoSlug, args.prId, args.commentId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
