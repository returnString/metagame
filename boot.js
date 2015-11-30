'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const config = require('./config')
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

module.exports = function(cb)
{
	const bootLog = log.create('boot')
	const platform = new PlatformClass()
	
	function initWorker(cb)
	{
		const server = new WebSocketServer({
			port: config.websocket.port
		})
		
		const router = new Router(server)
		
		async.series([cb =>
		{
			exec('git describe --always', (err, stdout, stderr) =>
			{
				if (!err && stdout)
				{
					const version = stdout.trim()
					config.version = version
					bootLog.info({ version: version }, 'retrieved git version')
				}
				
				cb()
			})
		}, cb =>
		{
			bootLog.info('initialising services')
			
			co(function*()
			{
				const servicesDir = './services/'
				const files = fs.readdirSync(servicesDir)
				for (const file of files)
				{
					const serviceName = file.split('.')[0]
					const ServiceClass = require(servicesDir + serviceName)
					
					const serviceLogger = log.create(serviceName)
					const service = new ServiceClass({
						log: serviceLogger,
						platform,
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
						const middleware = route[2]
						router.addRoute(path, handler, middleware)
					}
				}
				
				cb()
			}).catch(err =>
			{
				bootLog.error(err)
			})
		},
		], err =>
		{
			if (err) throw err
			router.start()
			bootLog.info('init done')
			cb()
		})
	}
	
	if (cluster.isMaster && config.clustering.enabled)
	{
		const coreCount = os.cpus().length
		const workerCount = coreCount * config.clustering.workersPerCore
		bootLog.info({ 
			coreCount,
			workerCount
		}, 'forking')
		
		for (let i = 0; i < workerCount; i++)
		{
			cluster.fork()
		}
		
		cb()
	}
	else
	{
		initWorker(cb)
	}
}