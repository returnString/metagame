'use strict'

const Platform = require('../core/platform')

class DebugPlatform extends Platform
{
	*authenticate(req)
	{
		return {
			userID: req.params.userID,
			userData: {},
			privileges: { server: req.params.server },
		} 
	}
}

module.exports = DebugPlatform