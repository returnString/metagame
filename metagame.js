'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const bluebird = require('bluebird')
const fs = require('fs')
const Router = require('./core/router')
const co = require('co')
const cluster = require('cluster')
const os = require('os')
const utils = require('./core/utils')
const core = require('./core')
const path = require('path')
const UserMap = require('./core/usermap')
const http = require('http')
const https = require('https')
const bunyan = require('bunyan')

core.require = modulePath => require(path.resolve(process.cwd(), modulePath))

const promisify = [ 'fs', 'mongodb', 'redis' ]
for (const moduleName of promisify)
{
	const module = require(moduleName)
	bluebird.promisifyAll(module)
}

class MetagameServer
{
	constructor(config)
	{
		this.config = config
		this.log = this.createLogger('server')
		this.userMap = new UserMap()
	}
	
	createLogger(name)
	{
		const logger = bunyan.createLogger({ name, workerID: utils.getWorkerID(), platform: this.config.platform })
		logger.level(this.config.logging.verbosity)
		return logger
	}
	
	*initWorker()
	{
		const platformClassCreator = core.require(this.config.platform)
		const PlatformClass = yield platformClassCreator(core)
		this.platform = new PlatformClass()
		
		function processHttpRequest(req, res)
		{
			res.writeHead(426)
			res.end('upgrade required for metagame websocket server')
		}
		
		this.httpServer = http.createServer(processHttpRequest).listen(this.config.websocket.port)
		
		if (this.config.websocket.ssl.enabled)
		{
			this.httpsServer = https.createServer({
				key: yield fs.readFileAsync(this.config.websocket.ssl.key),
				cert: yield fs.readFileAsync(this.config.websocket.ssl.cert),
			}, processHttpRequest).listen(this.config.websocket.ssl.port)
		}
		
		const webSocketServer = new WebSocketServer({
			server: this.httpServer,
		})
		
		const socketServers = [ webSocketServer ]
		
		if (this.httpsServer)
		{
			const secureWebSocketServer = new WebSocketServer({
				server: this.httpsServer,
			})
			
			socketServers.push(secureWebSocketServer)
		}

		const router = new Router(this.createLogger('router'), socketServers, this.config)
		
		for (const serviceFile of this.config.services)
		{
			const serviceClassCreator = core.require(serviceFile)
			const ServiceClass = yield serviceClassCreator(core)
			const service = new ServiceClass({
				platform: this.platform,
				userMap: this.userMap,
				config: this.config,
			})
			
			if (service.init)
			{
				yield service.init()
			}
			
			const routes = service.getRoutes()
			for (const route of routes)
			{
				const path = '/' + service.name + '/' + route[0]
				const handler = route[1].bind(service)
				let middleware = route[2]
				if (middleware)
				{
					middleware = middleware.map(func => func.bind(service))
				}
				router.addRoute(path, handler, middleware)
			}
		}
		
		router.start()
		this.log.info('init done')
	}
	
	*init()
	{
		if (cluster.isMaster && this.config.clustering.enabled)
		{
			const coreCount = os.cpus().length
			const workerCount = coreCount * this.config.clustering.workersPerCore
			this.log.info({ 
				coreCount,
				workerCount
			}, 'forking')
			
			for (let i = 0; i < workerCount; i++)
			{
				cluster.fork()
			}
		}
		else
		{
			yield this.initWorker()
		}
	}
	
	close()
	{
		this.httpServer.close()
		
		if (this.httpsServer)
		{
			this.httpsServer.close()
		}
	}
	
	get insecureAddress()
	{
		return this.httpServer.address()
	}
	
	get secureAddress()
	{
		if (!this.httpsServer)
		{
			throw new Error('No secure server available')
		}
		
		return this.httpsServer.address()
	}
}

if (module.parent)
{
	module.exports = MetagameServer
}
else
{
	co(function*()
	{
		const configPath = process.argv[2]
		if (!configPath)
		{
			throw new Error('Must specify a config path')
		}
		
		const config = yield core.require(configPath)
		const server = new MetagameServer(config)
		yield server.init()
	}).catch(err => { console.error(err.stack) })
}