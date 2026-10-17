import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, updatePullRequest} from '../../../bitbucket/bitbucket-client.js'
import {readTextValue, unescapeNewlines} from '../../../text-input.js'

export default class PrUpdate extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
    pullRequestId: Args.integer({description: 'Pull request ID', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Update a pull request'
  static override examples = [
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 1 --title "Updated title"',
    '<%= config.bin %> <%= command.id %> my-workspace my-repo 1 --description @pr.md',
  ]

  static override flags = {
    description: Flags.string({
      description: 'Pull request description. @<path> reads it from that file (@- for stdin; @@ for a literal @)',
      required: false,
    }),
    draft: Flags.boolean({
      allowNo: true,
      description: 'Mark the PR as draft (--draft) or ready for review (--no-draft)',
      required: false,
    }),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    title: Flags.string({description: 'Pull request title', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(PrUpdate)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const fields: Record<string, unknown> = {}
    if (flags.title) fields.title = flags.title
    if (flags.draft !== undefined) fields.draft = flags.draft
    if (flags.description) fields.description = await readTextValue(flags.description, unescapeNewlines)

    const result = await updatePullRequest(auth, args.workspace, args.repoSlug, args.pullRequestId, fields)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
