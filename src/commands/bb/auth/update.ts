import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthUpdateCommand({
  clearClients,
  configFile: 'bb-config.json',
  // Makes `-u, --host` optional: omission preserves the stored host and falls
  // back to Bitbucket Cloud only when the profile has none; an explicit -u
  // still wins (see @hesed/plugin-lib >= 0.13.1).
  defaultHost: 'https://bitbucket.org',
  serviceName: 'Bitbucket',
  testConnection,
})
