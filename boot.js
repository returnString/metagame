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

module.exports = function(cb)
{
	const bootLog = log.create('boot')
	const platform = new PlatformClass()
	const router = new Router()
	const workerID = utils.getWorkerID()
	
	function initWorker()
	{
		async.series([cb =>
		{
			bootLog.info('initialising services')
			
			const servicesDir = './services/'
			fs.readdir(servicesDir, (err, files) =>
			{
				if (err) return cb(err)
				
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
					
					const routes = service.getRoutes()
					for (const route of routes)
					{
						const path = route[0]
						const handler = route[1].bind(service)
						const options = route[2]
						router.addRoute(path, handler, options)
					}
				}
				bootLog.info({
					routes: Array.from(router.routes.keys()),
				}, 'service registered')
				
				cb()
			})
		}, cb =>
		{
			const server = new WebSocketServer({
				port: config.websocket.port
			})
			
			function respond(socket, data)
			{
				let response
				if (data instanceof errcode.MetagameError)
				{
					response = data
					response.error = true
				}
				else
				{
					response = { data }
				}
				
				response.workerID = workerID
				socket.send(JSON.stringify(response))
			}
			
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
						respond(socket, errcode.authenticationRequired())
						return
					}
					
					co(function*()
					{
						const data = yield router.dispatch(requestData.path, socket, requestData.params)
						respond(socket, data)
					}).catch(err =>
					{
						bootLog.error(err)
					})
				})
			})
			
			cb()
		}
		], err =>
		{
			if (err) throw err;
			bootLog.info('init done')
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
		initWorker()
		cb()
	}
}