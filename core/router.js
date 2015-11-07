'use strict'

const errcode = require('../core/errcode')

class Router
{
	constructor()
	{
		this.routes = new Map()
		this.usersBySocket = new Map()
	}
	
	addUser(userID, socket, userData, privileges)
	{
		this.usersBySocket.set(socket, {
			userID,
			socket,
			userData,
			privileges,
		})
	}
	
	removeUser(userID)
	{
		this.users.delete(userID)
	}
	
	addRoute(path, handler, options)
	{
		if (this.routes.has(path))
		{
			throw new Error('Duplicate route: ' + path)
		}
		
		this.routes.set(path, { handler, options: options || {} })
	}
	
	*dispatch(path, socket, params)
	{
		const route = this.routes.get(path)
		if (!route)
		{
			return errcode.routeNotFound(path)
		}
		
		let request = { params, socket }
		
		if (route.options.authenticated)
		{
			request.user = this.usersBySocket.get(socket)
			if (!request.user)
			{
				return errcode.authenticationRequired()
			}
		}
		
		return yield route.handler(request)
	}
}

module.exports = Router