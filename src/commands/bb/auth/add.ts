import {createAuthAddCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthAddCommand({
  clearClients,
  serviceName: 'Bitbucket',
  testConnection,
})
