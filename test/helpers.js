'use strict'

const WebSocket = require('ws')
const MetagameServer = require('../metagame')
const uuid = require('node-uuid')
const assert = require('assert')
const mongodb = require('mongodb')
const util = require('util')
const co = require('co')
const utils = require('../core/utils')

let currentServer

function* createSocket()
{
	const ws = new WebSocket('wss://localhost:' + currentServer.secureAddress.port, { rejectUnauthorized: false })
	return new Promise(resolve =>
	{
		ws.on('open', () =>
		{
			resolve(ws)
		})
	})
}

function* boot()
{	
	if (currentServer)
	{
		currentServer.close()
	}
	
	const config = require('../config_example')
	config.websocket.port = 0
	config.websocket.ssl.port = 0
	config.sandbox = 'tests'
	config.clustering.enabled = false
	config.logging.verbosity = 'error'
	
	currentServer = new MetagameServer(config)
	yield currentServer.init()
	
	for (const prop in config.mongodb)
	{
		const connectionProfile = config.mongodb[prop]
		const database = util.format('%s_%s_%s', config.sandbox, utils.detectName(currentServer.platform, 'platform'), connectionProfile.database || prop)
		const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
		const db = yield mongodb.MongoClient.connectAsync(connString)
		yield db.dropDatabase()
	}
}

function assertError(name)
{
	return res =>
	{
		assert.notEqual(res.error, null, 'Expected an error, got ' + JSON.stringify(res.data))
		assert.strictEqual(res.error.name, name)
	}
}

function assertOk(res)
{
	assert.equal(res.error, null, 'Expected no error, got ' + JSON.stringify(res.error))
}

function request(ws, path, params, tests)
{
	const correlation = uuid.v4()
	const messageToSend = { path, params, correlation }
	
	if (!tests)
	{
		tests = [ assertOk ]
	}
	else if (!Array.isArray(tests))
	{
		tests = [ tests ]
	}
	
	const promise = new Promise(resolve =>
	{
		ws.on('message', function gotMessage(message)
		{
			const response = JSON.parse(message)
			if (response.correlation === correlation)
			{
				for (const test of tests)
				{
					test(response)
				}
				
				ws.removeListener('message', gotMessage)
				resolve(response)
			}
		})
	})
	
	ws.send(JSON.stringify(messageToSend))
	return promise
}

function* createAuthedSocket(userID, client)
{
	const ws = yield createSocket()
	yield request(ws, '/auth/login', { userID: userID || 'ruan', client: client || 'game' })
	return ws
}

function* createServerSocket()
{
	const ws = yield createSocket()
	yield request(ws, '/auth/login', { server: true, client: 'game' })
	return ws
}

module.exports = {
	boot,
	createSocket,
	createAuthedSocket,
	createServerSocket,
	request,
	assertOk,
	assertError,
}