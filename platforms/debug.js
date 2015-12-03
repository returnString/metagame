'use strict'

const Platform = require('../core/platform')

class DebugPlatform extends Platform
{
	*authenticate(req)
	{
		return {
			id: req.params.userID,
			platformData: {},
			privileges: { server: req.params.server },
		} 
	}
}

module.exports = DebugPlatform