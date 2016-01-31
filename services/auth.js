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
			const loginSchema = {
				properties: {
					client: { type: 'string' },
				},
				required: [
					'client',
				],
			}
			
			return [
				[ 'login', this.login, [ this.schema(loginSchema) ] ],
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
			
			const userData = this.userMap.addUser(authData.id, req.socket, authData.platformData, authData.privileges, req.params.client, req.params.coords)
			return { ok: true, ip: userData.ip, id: authData.id }
		}
		
		*logout(req)
		{
			return { ok: this.userMap.removeUser(req.socket) }
		}
	}
	
	return AuthService
}
