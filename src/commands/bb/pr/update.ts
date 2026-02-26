import {Args, Command, Flags} from '@oclif/core'

import {clearClients, updatePullRequest} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class PrUpdate extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pullRequestId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Update a pull request'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo 1 --title "Updated title"']
  static override flags = {
    description: Flags.string({description: 'Pull request description', required: false}),
    title: Flags.string({description: 'Pull request title', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrUpdate)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const fields: Record<string, unknown> = {}
    if (flags.title) fields.title = flags.title
    // eslint-disable-next-line unicorn/prefer-string-replace-all
    if (flags.description) fields.description = flags.description.replace(/\\n/g, '\n').replace(/\\r/g, '\r')

    const result = await updatePullRequest(config.auth, args.workspace, args.repoSlug, args.pullRequestId, fields)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
