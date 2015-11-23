'use strict'

const Platform = require('../core/platform')

class DebugPlatform extends Platform
{
	*authenticate(req)
	{
		if (req.params.server)
		{
			return {
				userID: 'server',
				userData: {},
				privileges: { server: true },
			}
		}
		else
		{
			return {
				userID: req.params.userID,
				userData: {},
				privileges: {},
			} 
		}
	}
}

module.exports = DebugPlatform