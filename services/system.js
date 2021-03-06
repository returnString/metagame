'use strict'

module.exports = function*(loader)
{
	class SystemService extends loader.Service
	{
		getRoutes()
		{
			return [
				[ 'info', this.getInfo, [ this.authenticated ] ]
			]
		}
		
		*getInfo(params)
		{
			return {
				time: new Date().toISOString(),
			}
		}
	}
	
	return SystemService
}
