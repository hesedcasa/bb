import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthUpdateCommand({
  clearClients,
  configFile: 'bb-config.json',
  hasHostFlag: false,
  serviceName: 'Bitbucket',
  testConnection,
})
