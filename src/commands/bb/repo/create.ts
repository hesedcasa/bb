import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, createRepository} from '../../../bitbucket/bitbucket-client.js'

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
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    'project-key': Flags.string({description: 'Project key', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoCreate)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await createRepository(auth, args.workspace, args.repoSlug, {
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
