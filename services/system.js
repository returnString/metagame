'use strict'

const Service = require('../core/service');

class SystemService extends Service
{
	constructor(options)
	{
		super(options)
	}
	
	register(router)
	{
		router.addRoute('/system/time', this.getTime.bind(this))
	}
	
	*getTime(params)
	{
		return { time: new Date().toISOString() }
	}
}

module.exports = SystemService