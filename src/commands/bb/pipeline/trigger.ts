import {Args, Command, Flags} from '@oclif/core'

import {clearClients, triggerPipeline} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class PipelineTrigger extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Trigger a pipeline run'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --branch main',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --branch main --custom my-pipeline',
  ]
  static override flags = {
    branch: Flags.string({description: 'Branch name to run pipeline on', required: true}),
    custom: Flags.string({description: 'Custom pipeline pattern name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PipelineTrigger)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const target: {refName: string; refType: string; selector?: {pattern?: string; type?: string}} = {
      refName: flags.branch,
      refType: 'branch',
    }

    if (flags.custom) {
      target.selector = {
        pattern: flags.custom,
        type: 'custom',
      }
    }

    const result = await triggerPipeline(config.auth, args.workspace, args.repoSlug, target)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
