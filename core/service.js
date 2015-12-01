'use strict'

const errcode = require('./errcode')

class Service
{
	constructor(options)
	{
		this.log = options.log
		this.platform = options.platform
		this.router = options.router
	}
	
	*authenticated(request)
	{
		request.user = this.router.usersBySocket.get(request.socket)
		if (!request.user)
		{
			return errcode.authenticationRequired()
		}
	}
}

module.exports = Service