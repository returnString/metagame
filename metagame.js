'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const config = require('./config')
const bluebird = require('bluebird')
const fs = require('fs')
const Router = require('./core/router')
const errcode = require('./core/errcode')
const co = require('co')
const cluster = require('cluster')
const os = require('os')
const log = require('./core/log')
const utils = require('./core/utils')
const core = require('./core')
const path = require('path')
const UserMap = require('./core/usermap')
const http = require('http')
const https = require('https')

core.require = modulePath => require(path.resolve(process.cwd(), modulePath))

const promisify = [ 'fs', 'mongodb', 'redis' ]
for (const moduleName of promisify)
{
	const module = require(moduleName)
	bluebird.promisifyAll(module)
}

class MetagameServer
{
	constructor()
	{
		this.log = log.create('server')
		this.userMap = new UserMap()
	}
	
	*initWorker()
	{
		const platformClassCreator = core.require(config.platform)
		const PlatformClass = yield platformClassCreator(core)
		this.platform = new PlatformClass()
		
		function processHttpRequest(req, res)
		{
			res.writeHead(426)
			res.end('upgrade required for metagame websocket server')
		}
		
		this.httpServer = http.createServer(processHttpRequest).listen(config.websocket.port)
		
		if (config.websocket.ssl.enabled)
		{
			this.httpsServer = https.createServer({
				key: yield fs.readFileAsync(config.websocket.ssl.key),
				cert: yield fs.readFileAsync(config.websocket.ssl.cert),
			}, processHttpRequest).listen(config.websocket.ssl.port)
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

		const router = new Router(socketServers)
		
		const servicesDir = './services/'
		const files = yield fs.readdirAsync(servicesDir)
		for (const file of files)
		{
			const serviceName = file.split('.')[0]
			const serviceClassCreator = require(servicesDir + serviceName)
			const ServiceClass = yield serviceClassCreator(core)
			const serviceLogger = log.create(serviceName)
			const service = new ServiceClass({
				log: serviceLogger,
				platform: this.platform,
				router,
				userMap: this.userMap,
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
		if (cluster.isMaster && config.clustering.enabled)
		{
			const coreCount = os.cpus().length
			const workerCount = coreCount * config.clustering.workersPerCore
			this.log.info({ 
				coreCount,
				workerCount
			}, 'forking')
			
			for (let i = 0; i < workerCount; i++)
			{
				cluster.fork({ version: config.version })
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
	const server = new MetagameServer()
	co(function*()
	{
		yield server.init()
	}).catch(err => { server.log.error(err) })
}