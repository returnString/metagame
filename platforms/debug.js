'use strict'

module.exports = function*(loader)
{
	class DebugPlatform extends loader.Platform
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
	
	return DebugPlatform
}
