import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getPullRequest} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class PrGet extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pullRequestId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Get details of a specific pull request'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo 123']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrGet)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await getPullRequest(config.auth, args.workspace, args.repoSlug, args.pullRequestId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
