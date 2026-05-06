import {Command} from '@oclif/core'

import {type Profiles, readProfiles} from '../../../config.js'

interface ProfileInfo {
  email?: string
  name: string
}

interface ListResult {
  profiles: ProfileInfo[]
}

export default class AuthList extends Command {
  static override args = {}
  static override description = 'List authentication profiles'
  static override enableJsonFlag = true
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {}

  public async run(): Promise<ListResult> {
    await this.parse(AuthList)
    const profiles: Profiles | undefined = await readProfiles(this.config.configDir, this.log.bind(this))

    if (!profiles || Object.keys(profiles).length === 0) {
      this.log('No authentication profiles found. Run auth:add to add one.')
      return {profiles: []}
    }

    const profileList: ProfileInfo[] = Object.entries(profiles).map(([name, auth]) => ({
      ...(auth.email && {email: auth.email}),
      name,
    }))

    for (const profile of profileList) {
      const details = profile.email ? `email: ${profile.email}` : ''
      this.log(`${profile.name}${details ? ` (${details})` : ''}`)
    }

    return {profiles: profileList}
  }
}
