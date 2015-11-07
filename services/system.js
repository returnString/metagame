'use strict'

const Service = require('../core/service');
const config = require('../config')

class SystemService extends Service
{
	getRoutes()
	{
		return [
			[ '/system/info', this.getInfo, { authenticated: true } ]
		]
	}
	
	*getInfo(params)
	{
		return {
			time: new Date().toISOString(),
			version: config.version,
		}
	}
}

module.exports = SystemService