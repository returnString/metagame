'use strict'

const Service = require('../core/service');
const errcode = require('../core/errcode')
const config = require('../config')

class AuthService extends Service
{
	constructor(options)
	{
		super(options)
		this.validClients = new Set(config.users.allowedClients)
	}
	
	getRoutes()
	{
		return [
			[ '/auth/login', this.login ],
			[ '/auth/logout', this.logout, { authenticated: true } ],
		]
	}
	
	*login(req)
	{
		const authData = this.platform.authenticate(req)
		if (!this.validClients.has(req.params.client))
		{
			return errcode.invalidParam('client')
		}
		
		this.router.addUser(authData.userID, req.socket, authData.userData, authData.privileges, req.params.client)
		return { ok: true }
	}
	
	*logout(req)
	{
		return { ok: this.router.removeUser(req.socket) }
	}
}

module.exports = AuthService