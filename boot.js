'use strict'

const ws = require('ws')
const WebSocketServer = ws.Server
const config = require('./config')
const fs = require('fs')
const bunyan = require('bunyan')
const log = bunyan.createLogger({ name: 'boot' })
const Router = require('./core/router')
const async = require('async')
const router = new Router()
const PlatformClass = require('./platforms/' + config.platform)
const platform = new PlatformClass()
const errcode = require('./core/errcode')
const co = require('co')

async.series([cb =>
{
	log.info('initialising services')
	
	const servicesDir = './services/'
	fs.readdir(servicesDir, (err, files) =>
	{
		for (const file of files)
		{
			const serviceName = file.split('.')[0]
			log.info({ service: serviceName }, 'service registered')
			const ServiceClass = require(servicesDir + serviceName)
			
			const serviceLogger = bunyan.createLogger({ name: serviceName })
			const service = new ServiceClass({ log: serviceLogger, platform })
			service.register(router)
		}
		
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
				const response = yield router.dispatch(requestData.path, socket, requestData.params)
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
	log.info('init done')
})
