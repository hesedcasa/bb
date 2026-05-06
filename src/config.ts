import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

interface AuthConfig {
  apiToken: string
  email?: string
  host?: string
}

interface Config {
  auth: AuthConfig
}

export type Profiles = Record<string, AuthConfig>

export async function readConfig(configDir: string, log: (message: string) => void, profile = 'default'): Promise<Config | undefined> {
  const configPath = path.join(configDir, 'bb-config.json')

  try {
    const raw = await fs.readJSON(configPath)
    if (raw.profiles) {
      const auth = raw.profiles[profile] as AuthConfig | undefined
      if (!auth) {
        log(`Profile '${profile}' not found`)
        return undefined
      }

      return {auth}
    }

    // backward compat: old { auth: {...} } format
    if (profile !== 'default') {
      log(`Profile '${profile}' not found`)
      return undefined
    }

    return raw as Config
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.toLowerCase().includes('no such file or directory')) {
      log('Missing authentication config')
    } else {
      log(msg)
    }

    return undefined
  }
}

export async function readProfiles(configDir: string, log: (message: string) => void): Promise<Profiles | undefined> {
  const configPath = path.join(configDir, 'bb-config.json')

  try {
    const raw = await fs.readJSON(configPath)
    if (raw.profiles) {
      return raw.profiles as Profiles
    }

    // backward compat: treat old { auth: {...} } as the default profile
    if (raw.auth) {
      return {default: raw.auth as AuthConfig}
    }

    return {}
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.toLowerCase().includes('no such file or directory')) {
      log('No authentication profiles found')
    } else {
      log(msg)
    }

    return undefined
  }
}
