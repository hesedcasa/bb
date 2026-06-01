import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthUpdateCommand({
  clearClients,
  serviceName: 'Bitbucket',
  testConnection,
})
