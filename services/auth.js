'use strict'

module.exports = function*(core)
{
	const config = core.config
	const errcode = core.errcode
	
	class AuthService extends core.Service
	{
		*init()
		{
			this.validClients = new Set(config.users.allowedClients)
		}
		
		getRoutes()
		{
			return [
				[ '/auth/login', this.login ],
				[ '/auth/logout', this.logout, [ this.authenticated ] ],
			]
		}
		
		*login(req)
		{
			const authData = yield this.platform.authenticate(req)
			if (!this.validClients.has(req.params.client))
			{
				return errcode.invalidParam('client')
			}
			
			this.router.addUser(authData.id, req.socket, authData.platformData, authData.privileges, req.params.client)
			return { ok: true }
		}
		
		*logout(req)
		{
			return { ok: this.router.removeUser(req.socket) }
		}
	}
	
	return AuthService
}
