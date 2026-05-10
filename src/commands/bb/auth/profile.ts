import {Command, Flags} from '@oclif/core'

import {getDefaultProfile, setDefaultProfile} from '../../../config.js'

export default class AuthProfile extends Command {
  static override args = {}
  static override description = 'Set or show the default authentication profile'
  static override enableJsonFlag = true
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --default work',
  ]
  static override flags = {
    default: Flags.string({description: 'Profile name to set as default', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AuthProfile)

    if (flags.default) {
      await setDefaultProfile(this.config.configDir, flags.default, this.log.bind(this))
      return
    }

    const current = await getDefaultProfile(this.config.configDir)
    this.log(current)
  }
}
