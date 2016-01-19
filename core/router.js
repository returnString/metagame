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
		this.advertisedRoutes = {}
	}
	
	addRoute(path, handler, middleware)
	{
		if (this.routes.has(path))
		{
			throw new Error('Duplicate route: ' + path)
		}
		
		this.routes.set(path, { handler, middleware })
		
		const advertisedRoute = { }
		this.advertisedRoutes[path] = advertisedRoute
		
		if (middleware)
		{
			for (const middlewareFunc of middleware)
			{
				if (middlewareFunc.data)
				{
					const slot = middlewareFunc.desc || middlewareFunc.name
					advertisedRoute[slot] = middlewareFunc.data
				}
			}
		}
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
		this.addRoute('/routes', function*(request)
		{
			return this.advertisedRoutes
		}.bind(this))
		
		for (const socketServer of this.socketServers)
		{
			socketServer.on('connection', socket =>
			{
				socket.on('message', message => this.onMessage(socket, message))
			})
		}
	}
	
	respond(socket, data, correlation, receivedAt)
	{
		const dataSlot = data instanceof MetagameError ? 'error' : 'data'
		const response = {
			[dataSlot]: data,
			workerID: utils.getWorkerID(),
			timeTaken: Date.now() - receivedAt,
			correlation,
		}
		
		socket.send(JSON.stringify(response))
		
		this.log.debug({ response }, 'response sent')
	}
	
	onMessage(socket, message)
	{
		const receivedAt = Date.now()

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
			this.respond(socket, this.errors.messageParsingFailed(), requestData.correlation, receivedAt)
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
				data = self.errors.internalError()
			}
			
			self.respond(socket, data, requestData.correlation, receivedAt)
		}).catch(err =>
		{
			self.log.error(err)
		})
	}
}

module.exports = Router