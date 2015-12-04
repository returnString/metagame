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
		this.socketServer = socketServer
		this.log = log.create('router')
	}
	
	addRoute(path, handler, middleware)
	{
		if (this.routes.has(path))
		{
			throw new Error('Duplicate route: ' + path)
		}
		
		this.routes.set(path, { handler, middleware })
	}
	
	*dispatch(path, socket, params)
	{
		const route = this.routes.get(path)
		if (!route)
		{
			return errcode.routeNotFound(path)
		}
		
		let request = { params, socket }
		
		if (route.middleware)
		{
			for (const middleware of route.middleware)
			{
				const result = yield middleware(request)
				if (result)
				{
					return result
				}
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
	
	respond(socket, data, correlation, timeTaken)
	{
		const dataSlot = data instanceof errcode.MetagameError ? 'error' : 'data'
		const response = {
			[dataSlot]: data,
			workerID: utils.getWorkerID(),
			timeTaken,
			correlation,
		}
		
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
		
		const receivedAt = Date.now()
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
			
			const timeTaken = Date.now() - receivedAt
			self.respond(socket, data, requestData.correlation, timeTaken)
		}).catch(err =>
		{
			self.log.error(err)
		})
	}
}

module.exports = Router