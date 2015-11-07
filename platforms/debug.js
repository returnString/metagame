'use strict'

class DebugPlatform
{
	constructor()
	{
	}
	
	*authenticate(req)
	{
		return {
			userID: req.params.userID,
			userData: {},
			privileges: [],
		} 
	}
}

module.exports = DebugPlatform