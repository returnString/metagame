'use strict'

const Service = require('../core/service');

class AuthService extends Service
{
	constructor(options)
	{
		super(options)
	}
	
	register(router)
	{
		this.router = router
		router.addRoute('/auth', this.authenticate.bind(this))
	}
	
	*authenticate(req)
	{
		const authData = this.platform.authenticate(req)
		this.router.addUser(authData.userID, req.socket, authData.userData, authData.privileges)
		return { ok: true }
	}
}

module.exports = AuthService