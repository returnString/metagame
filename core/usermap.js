'use strict'

class UserMap
{
	constructor()
	{
		this.clientsByUserID = new Map()
		this.usersBySocket = new Map()
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
		
		this.usersBySocket.set(socket, {
			id,
			socket,
			platformData,
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