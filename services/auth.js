'use strict'

module.exports = function*(core)
{
	const config = core.config
	const errcode = core.errcode
	
	class AuthService extends core.Service
	{
		get name() { return 'auth' }
		
		*init()
		{
			this.validClients = new Set(config.users.allowedClients)
		}
		
		getRoutes()
		{
			return [
				[ 'login', this.login ],
				[ 'logout', this.logout, [ this.authenticated ] ],
			]
		}
		
		*login(req)
		{
			const authData = yield this.platform.authenticate(req)
			if (!this.validClients.has(req.params.client))
			{
				return errcode.invalidParam('client')
			}
			
			this.userMap.addUser(authData.id, req.socket, authData.platformData, authData.privileges, req.params.client)
			return { ok: true }
		}
		
		*logout(req)
		{
			return { ok: this.userMap.removeUser(req.socket) }
		}
	}
	
	return AuthService
}
