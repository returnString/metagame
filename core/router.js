'use strict'

const errcode = require('../core/errcode')

class Router
{
	constructor()
	{
		this.routes = new Map()
		this.usersBySocket = new Map()
		this.clientsByUserID = new Map()
	}
	
	addUser(userID, socket, userData, privileges, client)
	{
		let clients = this.clientsByUserID.get(userID)
		if (!clients)
		{
			clients = {}
			this.clientsByUserID.set(userID, clients)
		}
		
		clients[client] = socket
		
		this.usersBySocket.set(socket, {
			userID,
			socket,
			userData,
			privileges,
			client,
		})
	}
	
	removeUser(socket)
	{
		const data = this.usersBySocket.get(socket)
		if (!data)
		{
			return false
		}
		
		const clients = this.clientsByUserID.get(data.userID)
		delete clients[data.client]
		
		if (Object.keys(clients).length === 0)
		{
			this.clientsByUserID.delete(data.userID)
		}
		
		return this.usersBySocket.delete(socket)
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