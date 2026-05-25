import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../bitbucket/bitbucket-client.js'

export default createAuthUpdateCommand({
  clearClients,
  hasHostFlag: false,
  serviceName: 'Bitbucket',
  testConnection,
})
