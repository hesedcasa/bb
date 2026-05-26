import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getPipeline} from '../../../bitbucket/bitbucket-client.js'

export default class PipelineGet extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pipelineUuid: Args.string({description: 'Pipeline UUID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Get details of a specific pipeline'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo {uuid}']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PipelineGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const result = await getPipeline(auth, args.workspace, args.repoSlug, args.pipelineUuid)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
