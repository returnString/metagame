'use strict'

const errcode = require('../core/errcode')
const co = require('co')
const log = require('./log')
const utils = require('./utils')

class Router
{
	constructor(socketServer)
	{
		this.routes = new Map()
		this.usersBySocket = new Map()
		this.clientsByUserID = new Map()
		this.socketServer = socketServer
		this.log = log.create('router')
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
	
	start()
	{
		this.socketServer.on('connection', socket =>
		{
			socket.on('message', message => this.onMessage(socket, message))
		})
	}
	
	respond(socket, data, correlation)
	{
		let response
		if (data instanceof errcode.MetagameError)
		{
			response = data
		}
		else
		{
			response = { data }
		}
		
		response.workerID = utils.getWorkerID()
		response.correlation = correlation
		socket.send(JSON.stringify(response))
		
		this.log.debug({ response }, 'response sent')
	}
	
	onMessage(socket, message)
	{
		let requestData
		try
		{
			requestData = JSON.parse(message)
		}
		catch (err)
		{
			this.respond(socket, errcode.messageParsingFailed())
			return
		}
		
		this.log.debug({ requestData }, 'message received')
		
		const self = this
		co(function*()
		{
			let data
			try
			{
				data = yield self.dispatch(requestData.path, socket, requestData.params || {})
			}
			catch (err)
			{
				self.log.error(err)
				data = errcode.internalError()
			}
			self.respond(socket, data, requestData.correlation)
		}).catch(err =>
		{
			self.log.error(err)
		})
	}
}

module.exports = Router