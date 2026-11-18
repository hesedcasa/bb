import {createAuthAddCommand} from '@hesed/plugin-lib'

import {withOptionalHost} from '../../../auth-host.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

const CONFIG_FILE = 'bb-config.json'

// `-u, --host` is optional here and defaults to Bitbucket Cloud; see
// src/auth-host.ts for why the relaxation is local to this CLI.
export default withOptionalHost(
  createAuthAddCommand({
    clearClients,
    configFile: CONFIG_FILE,
    serviceName: 'Bitbucket',
    testConnection,
  }),
  {configFile: CONFIG_FILE, mode: 'add'},
)
