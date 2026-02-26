import {default as fs} from 'fs-extra'
import {default as path} from 'node:path'

interface AuthConfig {
  apiToken: string
  email: string
  host: string
}

interface Config {
  auth: AuthConfig
}

export async function readConfig(configDir: string, log: (message: string) => void): Promise<Config | undefined> {
  const configPath = path.join(configDir, 'bb-config.json')

  try {
    return await fs.readJSON(configPath)
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
