'use strict'

class Service
{
	constructor(options)
	{
		this.log = options.log
		this.platform = options.platform
	}
}

module.exports = Service