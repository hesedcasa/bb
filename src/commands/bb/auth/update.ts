import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {withOptionalHost} from '../../../auth-host.js'
import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

const CONFIG_FILE = 'bb-config.json'

// `-u, --host` is optional here: omission preserves the stored host and falls
// back to Bitbucket Cloud; see src/auth-host.ts.
export default withOptionalHost(
  createAuthUpdateCommand({
    clearClients,
    configFile: CONFIG_FILE,
    serviceName: 'Bitbucket',
    testConnection,
  }),
  {configFile: CONFIG_FILE, mode: 'update'},
)
