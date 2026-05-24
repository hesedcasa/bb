import {createAuthAddCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthAddCommand({
  clearClients,
  configFile: 'bb-config.json',
  hasHostFlag: false,
  serviceName: 'Bitbucket',
  testConnection,
})
