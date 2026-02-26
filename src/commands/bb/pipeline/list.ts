import {Args, Command, Flags} from '@oclif/core'

import {clearClients, listPipelines} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class PipelineList extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'List pipelines for a repository'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo']
  static override flags = {
    page: Flags.integer({default: 1, description: 'Page number', required: false}),
    pagelen: Flags.integer({default: 10, description: 'Number of items per page', required: false}),
    sort: Flags.string({description: 'Sort field (e.g., created_on)', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PipelineList)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await listPipelines(
      config.auth,
      args.workspace,
      args.repoSlug,
      flags.page,
      flags.pagelen,
      flags.sort,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
