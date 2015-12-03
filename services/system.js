'use strict'

module.exports = function*(core)
{
	class SystemService extends core.Service
	{
		getRoutes()
		{
			return [
				[ '/system/info', this.getInfo, [ this.authenticated ] ]
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
