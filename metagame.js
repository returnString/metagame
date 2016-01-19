'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const bluebird = require('bluebird')
const fs = require('fs')
const co = require('co')
const cluster = require('cluster')
const os = require('os')
const path = require('path')
const http = require('http')
const https = require('https')
const bunyan = require('bunyan')
const Router = require('./core/router')
const utils = require('./core/utils')
const UserMap = require('./core/usermap')

const loader = {
	require: modulePath => require(path.resolve(process.cwd(), modulePath)),
	Platform: require('./core/platform'),
	Service: require('./core/service'),
}

const promisify = [ 'fs', 'redis' ]
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
		this.userMap = new UserMap(config)
	}
	
	createLogger(name)
	{
		const logger = bunyan.createLogger({ name, workerID: utils.getWorkerID(), platform: this.platform.name })
		logger.level(this.config.logging.verbosity)
		return logger
	}
	
	*initPlatform()
	{
		const platformClassCreator = loader.require(this.config.platform)
		const PlatformClass = yield platformClassCreator(loader)
		this.platform = new PlatformClass()
		this.log = this.createLogger('server')
	}
	
	*initWorker()
	{
		function processHttpRequest(req, res)
		{
			res.writeHead(426)
			res.end('upgrade required for metagame websocket server')
		}
		
		this.httpServer = http.createServer(processHttpRequest).listen(this.config.server.port, this.config.server.bind)
		
		if (this.config.server.tls.enabled)
		{
			this.httpsServer = https.createServer({
				key: yield fs.readFileAsync(this.config.server.tls.key),
				cert: yield fs.readFileAsync(this.config.server.tls.cert),
			}, processHttpRequest).listen(this.config.server.tls.port, this.config.server.bind)
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
			const serviceClassCreator = loader.require(serviceFile)
			const ServiceClass = yield serviceClassCreator(loader)
			const service = new ServiceClass({
				platform: this.platform,
				userMap: this.userMap,
				config: this.config,
			})
			
			service.log = this.createLogger(service.name)
			
			if (service.init)
			{
				yield service.init()
			}
			
			const routes = service.getRoutes()
			for (const route of routes)
			{
				const path = '/' + service.name + '/' + route[0]
				const handler = route[1].bind(service)
				const middleware = route[2] ? route[2].map(func => utils.bindAndCopy(func, service)) : null
				router.addRoute(path, handler, middleware)
			}
		}
		
		router.start()
		this.log.info({ inscecureAddress: this.insecureAddress, secureAddress: this.secureAddress }, 'init done')
		if (cluster.isWorker)
		{
			process.send('initDone')
		}
	}
	
	*init()
	{
		yield this.initPlatform()
	
		if (cluster.isMaster && this.config.clustering.enabled)
		{
			const coreCount = os.cpus().length
			const workerCount = coreCount * this.config.clustering.workersPerCore
			this.log.info({ 
				coreCount,
				workerCount
			}, 'forking')
			
			cluster.on('exit', (worker, code, signal) =>
			{
				const replacement = cluster.fork()
				this.log.info({
					code,
					signal,
					dead: worker.id,
					replacement: replacement.id,
				})
			})
			
			let initialisedWorkers = 0
			for (let i = 0; i < workerCount; i++)
			{
				const worker = cluster.fork()
				worker.on('message', message =>
				{
					if (message === 'initDone' && ++initialisedWorkers === workerCount)
					{
						this.log.info('all workers intialised')
					}
				})
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
	const configPath = process.argv[2]
	if (!configPath)
	{
		throw new Error('Must specify a config path')
	}
	
	const config = loader.require(configPath)
	const server = new MetagameServer(config)
	co(function*()
	{
		yield server.init()
	}).catch(err => console.error(err.stack))
}