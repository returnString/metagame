'use strict'

const Service = require('../core/service')
const config = require('../config')
const middleware = require('../core/middleware')

class SystemService extends Service
{
	getRoutes()
	{
		return [
			[ '/system/info', this.getInfo, [ middleware.authenticated ] ]
		]
	}
	
	*getInfo(params)
	{
		return {
			time: new Date().toISOString(),
		}
	}
}

module.exports = SystemService