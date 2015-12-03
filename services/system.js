'use strict'

module.exports = function*(core)
{
	class SystemService extends core.Service
	{
		get name() { return 'system' }
		
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
