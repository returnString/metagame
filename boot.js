'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const config = require('./config')
const fs = require('fs')
const bunyan = require('bunyan')
const Router = require('./core/router')
const async = require('async')
const router = new Router()
const PlatformClass = require('./platforms/' + config.platform)
const platform = new PlatformClass()
const errcode = require('./core/errcode')
const co = require('co')
const cluster = require('cluster')
const os = require('os')

const workerID = cluster.isMaster ? 'master' : cluster.worker.id
const log = bunyan.createLogger({ name: 'boot', workerID })

function initWorker()
{
	async.series([cb =>
	{
		log.info('initialising services')
		
		const servicesDir = './services/'
		fs.readdir(servicesDir, (err, files) =>
		{
			if (err) return cb(err)
			
			for (const file of files)
			{
				const serviceName = file.split('.')[0]
				log.info({ service: serviceName }, 'service registered')
				const ServiceClass = require(servicesDir + serviceName)
				
				const serviceLogger = bunyan.createLogger({ name: serviceName, workerID })
				const service = new ServiceClass({
					log: serviceLogger,
					platform,
					router,
				})
				
				const routes = service.getRoutes()
				for (const route of routes)
				{
					const path = route[0]
					const handler = route[1].bind(service)
					const options = route[2]
					router.addRoute(path, handler, options)
				}
			}
			log.info({
				routes: Array.from(router.routes.keys()),
			}, 'registered routes')
			
			cb()
		})
	}, cb =>
	{
		const server = new WebSocketServer({
			port: config.websocket.port
		})
		
		server.on('connection', socket =>
		{
			socket.on('message', message =>
			{
				let requestData
				try
				{
					requestData = JSON.parse(message)
				}
				catch (err)
				{
					socket.send({ error: errcode.messageParsingFailed })
				}
				
				co(function*()
				{
					const data = yield router.dispatch(requestData.path, socket, requestData.params)
					const response = { data, workerID }
					socket.send(JSON.stringify(response))
				}).catch(err =>
				{
					log.error(err)
				})
			})
		})
		
		cb()
	}
	], err =>
	{
		if (err) throw err;
		log.info('init done')
	})
}

if (cluster.isMaster && config.clustering.enabled)
{
	const coreCount = os.cpus().length
	const workerCount = coreCount * config.clustering.workersPerCore
	log.info({ 
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
	initWorker()
}

