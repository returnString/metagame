'use strict'

const Service = require('../core/service');

class SystemService extends Service
{
	getRoutes()
	{
		return [
			[ '/system/time', this.getTime, { authenticated: true } ]
		]
	}
	
	*getTime(params)
	{
		return { time: new Date().toISOString() }
	}
}

module.exports = SystemService