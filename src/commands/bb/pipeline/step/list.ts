import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base-command.js'
import {clearClients, listPipelineSteps} from '../../../../bitbucket/bitbucket-client.js'

export default class PipelineStepList extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pipelineUuid: Args.string({description: 'Pipeline UUID', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'List the steps of a specific pipeline'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo {pipeline-uuid}']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(PipelineStepList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await listPipelineSteps(auth, args.workspace, args.repoSlug, args.pipelineUuid)
    clearClients()

    if (flags.toon) {
      // JSON mode is off under --toon, so a failed result would otherwise be
      // swallowed by TOON formatting: emit the structured JSON error instead.
      if (result.success) {
        this.log(formatAsToon(result))
      } else {
        this.logJson(result)
      }
    }

    return result
  }
}
