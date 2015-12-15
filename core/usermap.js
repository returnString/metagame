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
		if (this.config.websocket.proxied)
		{
			const forwardedFor = socket.upgradeReq.headers['x-forwarded-for']
			if (forwardedFor)
			{
				return forwardedFor
			}
		}
		
		return socket.upgradeReq.connection.remoteAddress
	}
	
	addUser(id, socket, platformData, privileges, client)
	{
		let clients = this.clientsByUserID.get(id)
		if (!clients)
		{
			clients = {}
			this.clientsByUserID.set(id, clients)
		}
		
		clients[client] = socket
		
		const ip = this.getIP(socket)
		const geo = this.config.geolocation.enabled ? geoip.lookup(ip) : null
		
		this.usersBySocket.set(socket, {
			id,
			socket,
			platformData,
			privileges,
			client,
			ip,
			geo,
		})
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