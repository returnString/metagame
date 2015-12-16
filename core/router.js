'use strict'

const co = require('co')
const utils = require('./utils')
const error = require('./error')
const MetagameError = error.MetagameError
const ErrorContainer = error.ErrorContainer

class Router
{
	constructor(log, socketServers, config)
	{
		this.routes = new Map()
		this.socketServers = socketServers
		this.log = log
		this.errors = new ErrorContainer('router', config)
		this.errors.register('notFound')
		this.errors.register('internalError')
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
			return this.errors.notFound(path)
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
		for (const socketServer of this.socketServers)
		{
			socketServer.on('connection', socket =>
			{
				socket.on('message', message => this.onMessage(socket, message))
			})
		}
	}
	
	respond(socket, data, correlation, timeTaken)
	{
		const dataSlot = data instanceof MetagameError ? 'error' : 'data'
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
			// swallow parse errors
		}
		
		if (!requestData || !requestData.path)
		{
			this.respond(socket, this.errors.messageParsingFailed())
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
				data = self.errors.internalError()
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