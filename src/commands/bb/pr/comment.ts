import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, createPullRequestComment} from '../../../bitbucket/bitbucket-client.js'

export default class PrComment extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    prId: Args.integer({description: 'Pull request ID', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add a comment to a pull request, optionally on a specific file and line'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 42 --body "Looks good!"',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 42 --body "Fix this" --file src/foo.ts --line 15',
  ]
  static override flags = {
    body: Flags.string({description: 'Comment text', required: true}),
    file: Flags.string({description: 'File path for inline comment', required: false}),
    line: Flags.integer({description: 'Line number for inline comment', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PrComment)

    if ((flags.file === undefined) !== (flags.line === undefined)) {
      this.error('--file and --line must be used together')
    }

    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const inline = flags.file && flags.line !== undefined ? {line: flags.line, path: flags.file} : undefined

    const result = await createPullRequestComment(auth, args.workspace, args.repoSlug, args.prId, flags.body, inline)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
