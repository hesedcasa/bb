import {Args, Command, Flags} from '@oclif/core'

import {clearClients, createRepository} from '../../../bitbucket/bitbucket-client.js'
import {readConfig} from '../../../config.js'
import {formatAsToon} from '../../../format.js'

export default class RepoCreate extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Create a new repository'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo --private --description "My new repo"',
  ]
  static override flags = {
    description: Flags.string({description: 'Repository description', required: false}),
    language: Flags.string({description: 'Repository language', required: false}),
    private: Flags.boolean({default: false, description: 'Make repository private', required: false}),
    'project-key': Flags.string({description: 'Project key', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoCreate)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await createRepository(config.auth, args.workspace, args.repoSlug, {
      description: flags.description,
      isPrivate: flags.private,
      language: flags.language,
      projectKey: flags['project-key'],
    })
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
