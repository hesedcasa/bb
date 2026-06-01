import {createAuthTestCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthTestCommand({
  clearClients,
  serviceName: 'Bitbucket',
  testConnection,
})
