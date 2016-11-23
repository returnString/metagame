'use strict'

const WebSocket = require('ws')
const MetagameServer = require('../metagame')
const uuid = require('uuid')
const assert = require('assert')
const mongodb = require('mongodb')
const util = require('util')
const co = require('co')
const utils = require('../core/utils')
const config = require('../sample_game/config')
config.server.port = 0
config.server.tls.port = 0
config.sandbox = 'tests'
config.clustering.enabled = false
config.logging.verbosity = 'error'
config.mongodb.defaultWriteConcern = 1
config.geolocation.allowOverride = true

let currentServer
let initialised = false

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

function* createMongoConnection(dbName)
{
	const connectionProfile = config.mongodb.connections[dbName]
	const database = util.format('%s_%s_%s', config.sandbox, currentServer.platform.name, connectionProfile.database || dbName)
	const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
	return yield mongodb.MongoClient.connect(connString)
}

function* clearMongo(dbName)
{
	const db = yield createMongoConnection(dbName)
	yield db.dropDatabase()
}

function* clearMongoCollections(dbName)
{
	const db = yield createMongoConnection(dbName)
	const collectionQuery = db.listCollections()
	const collectionNames = yield collectionQuery.toArray()
	for (const collection of collectionNames)
	{
		if (!collection.name.startsWith('system'))
		{
			// we specifically want to remove all documents, not delete the collection itself
			// we need to preserve indices that have already have an ensureIndex call
			// eg matchmaking's geospatial 'pos' index
			yield db.collection(collection.name).remove({})
		}
	}
}

function* boot()
{	
	if (currentServer)
	{
		currentServer.close()
	}
	
	currentServer = new MetagameServer(config)
	yield currentServer.init()
	
	if (!initialised)
	{
		initialised = true
		for (const prop in config.mongodb.connections)
		{
			yield clearMongo(prop)
		}
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

function* createAuthedSocket(userID, options)
{
	options = options || {}
	const ws = yield createSocket()
	yield request(ws, '/auth/login', { userID: userID || 'ruan', client: options.client || 'game', coords: options.coords })
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
	clearMongo,
	clearMongoCollections,
	createSocket,
	createAuthedSocket,
	createServerSocket,
	request,
	assertOk,
	assertError,
}