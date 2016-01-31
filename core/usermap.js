'use strict'

const geoip = require('geoip-lite')

class UserMap
{
	constructor(config)
	{
		this.config = config
		this.clientsByUserID = new Map()
		this.usersBySocket = new Map()
	}
	
	getIP(socket)
	{
		if (this.config.server.proxied)
		{
			const forwardedFor = socket.upgradeReq.headers['x-forwarded-for']
			if (forwardedFor)
			{
				return forwardedFor
			}
		}
		
		return socket.upgradeReq.connection.remoteAddress
	}
	
	addUser(id, socket, platformData, privileges, client, coords)
	{
		let clients = this.clientsByUserID.get(id)
		if (!clients)
		{
			clients = {}
			this.clientsByUserID.set(id, clients)
		}
		
		clients[client] = socket
		
		const ip = this.getIP(socket)
		
		let geo = null
		if (this.config.geolocation.allowOverride && coords)
		{
			geo = { ll: coords }
		}
		else if (this.config.geolocation.enabled)
		{
			geo = geoip.lookup(ip)
		}
		
		socket.geo = geo
		
		const data = {
			id,
			socket,
			platformData,
			privileges,
			client,
			ip,
			geo,
		}
		this.usersBySocket.set(socket, data)
		return data
	}
	
	removeUser(socket)
	{
		const data = this.usersBySocket.get(socket)
		if (!data)
		{
			return false
		}
		
		const clients = this.clientsByUserID.get(data.id)
		delete clients[data.client]
		
		if (Object.keys(clients).length === 0)
		{
			this.clientsByUserID.delete(data.id)
		}
		
		return this.usersBySocket.delete(socket)
	}
}

module.exports = UserMap