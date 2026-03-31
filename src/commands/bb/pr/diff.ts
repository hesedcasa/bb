import {Args, Command} from '@oclif/core'

import {clearClients, getPullRequestDiff} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'

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

  public async run(): Promise<void> {
    const {args} = await this.parse(PrDiff)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await getPullRequestDiff(config.auth, args.workspace, args.repoSlug, args.pullRequestId)
    clearClients()

    if (result.success) {
      this.log(result.data as string)
    } else {
      this.logJson(result)
    }
  }
}
