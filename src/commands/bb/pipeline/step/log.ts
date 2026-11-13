import {createProfileManager} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base-command.js'
import {clearClients, getPipelineStepLog} from '../../../../bitbucket/bitbucket-client.js'

export default class PipelineStepLog extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pipelineUuid: Args.string({description: 'Pipeline UUID', required: true}),
    stepUuid: Args.string({description: 'Step UUID', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = "Get a pipeline step's build log as plain text"
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo {pipeline-uuid} {step-uuid}']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
  }

  public override jsonEnabled(): boolean {
    return false
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PipelineStepLog)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getPipelineStepLog(auth, args.workspace, args.repoSlug, args.pipelineUuid, args.stepUuid)
    clearClients()

    if (result.success) {
      this.log(result.data as string)
    } else {
      this.logJson(result)
    }
  }
}
