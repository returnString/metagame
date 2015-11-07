'use strict'

const WebSocket = require('ws')
const boot = require('../boot')
const config = require('../config')

function createSocket()
{
	return new WebSocket('ws://localhost:' + config.websocket.testPort)
}

exports.boot = function(cb)
{
	config.websocket.port = config.websocket.testPort
	config.clustering.enabled = false
	config.logging.verbosity = 100
	
	boot(() =>
	{
		cb(createSocket)
	})
}