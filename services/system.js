'use strict'

const Service = require('../core/service')
const config = require('../config')

class SystemService extends Service
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

module.exports = SystemService