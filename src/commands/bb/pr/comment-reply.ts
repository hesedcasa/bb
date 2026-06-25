import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, replyToPullRequestComment} from '../../../bitbucket/bitbucket-client.js'

export default class PrCommentReply extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    prId: Args.integer({description: 'Pull request ID', required: true}),
    commentId: Args.integer({description: 'Comment ID to reply to', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Reply to a comment on a pull request'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 42 100 --body "Thanks for the feedback!"',
  ]
  static override flags = {
    body: Flags.string({description: 'Reply text', required: true}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(PrCommentReply)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await replyToPullRequestComment(
      auth,
      args.workspace,
      args.repoSlug,
      args.prId,
      args.commentId,
      flags.body,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
