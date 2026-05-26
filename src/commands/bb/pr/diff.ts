import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getPullRequestDiff} from '../../../bitbucket/bitbucket-client.js'
import {createProfileManager} from '@hesed/plugin-lib'

export default class PrDiff extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pullRequestId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Get the diff for a pull request'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo 123']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrDiff)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const result = await getPullRequestDiff(auth, args.workspace, args.repoSlug, args.pullRequestId)
    clearClients()

    if (result.success) {
      this.log(result.data as string)
    } else {
      this.logJson(result)
    }
  }
}
