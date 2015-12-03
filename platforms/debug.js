'use strict'

module.exports = function*(core)
{
	class DebugPlatform extends core.Platform
	{
		get name() { return 'debug' }
		
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
