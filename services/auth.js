'use strict'

module.exports = function*(loader)
{
	class AuthService extends loader.Service
	{
		*init()
		{
			this.validClients = new Set(this.config.users.allowedClients)
		}
		
		getRoutes()
		{
			return [
				[ 'login', this.login, [ this.schema({ client: { type: 'string' } }) ] ],
				[ 'logout', this.logout, [ this.authenticated ] ],
			]
		}
		
		*login(req)
		{
			const authData = yield this.platform.authenticate(req)
			if (!this.validClients.has(req.params.client))
			{
				return this.errors.invalidParam('client')
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
