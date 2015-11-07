'use strict'

class Service
{
	constructor(options)
	{
		this.log = options.log
		this.platform = options.platform
		this.router = options.router
	}
}

module.exports = Service