'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const config = require('./config')
const bluebird = require('bluebird')
const fs = require('fs')
const Router = require('./core/router')
const async = require('async')
const PlatformClass = require('./platforms/' + config.platform)
const errcode = require('./core/errcode')
const co = require('co')
const cluster = require('cluster')
const os = require('os')
const log = require('./core/log')
const utils = require('./core/utils')
const exec = require('child_process').exec

const promisify = [ 'fs', 'mongodb' ]
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
		this.platform = new PlatformClass()
	}
	
	*initWorker()
	{
		this.webSocketServer = new WebSocketServer({
			port: config.websocket.port
		})
		
		this.httpServer = this.webSocketServer._server
		const router = new Router(this.webSocketServer)
		
		const servicesDir = './services/'
		const files = yield fs.readdirAsync(servicesDir)
		for (const file of files)
		{
			const serviceName = file.split('.')[0]
			const ServiceClass = require(servicesDir + serviceName)
			
			const serviceLogger = log.create(serviceName)
			const service = new ServiceClass({
				log: serviceLogger,
				platform: this.platform,
				router,
			})
			
			if (service.init)
			{
				yield service.init()
			}
			
			const routes = service.getRoutes()
			for (const route of routes)
			{
				const path = route[0]
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
		this.webSocketServer.close()
	}
	
	get address()
	{
		return this.httpServer.address()
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
		const server = new MetagameServer()
		yield server.init()
	}).catch(err => { throw err })
}