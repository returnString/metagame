'use strict'

const Service = require('../core/service');

class AuthService extends Service
{
	constructor(options)
	{
		super(options)
	}
	
	getRoutes()
	{
		return [
			[ '/auth', this.authenticate ]
		]
	}
	
	*authenticate(req)
	{
		const authData = this.platform.authenticate(req)
		this.router.addUser(authData.userID, req.socket, authData.userData, authData.privileges)
		return { ok: true }
	}
}

module.exports = AuthService