'use strict'

const Service = require('../core/service');

class SystemService extends Service
{
	constructor(options)
	{
		super(options)
	}
	
	getRoutes()
	{
		return [
			[ '/system/time', this.getTime, { loggedIn: true } ]
		]
	}
	
	*getTime(params)
	{
		return { time: new Date().toISOString() }
	}
}

module.exports = SystemService