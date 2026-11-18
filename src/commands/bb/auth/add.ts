import {createAuthAddCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthAddCommand({
  clearClients,
  configFile: 'bb-config.json',
  // Makes `-u, --host` optional: omission stores Bitbucket Cloud; an explicit
  // -u still wins (see @hesed/plugin-lib >= 0.13.1).
  defaultHost: 'https://bitbucket.org',
  serviceName: 'Bitbucket',
  testConnection,
})
