'use strict'

const WebSocket = require('ws')
const MetagameServer = require('../metagame')
const config = require('../config')
const async = require('async')
const uuid = require('node-uuid')
const assert = require('assert')
const mongodb = require('mongodb')
const util = require('util')
const co = require('co')

let currentServer

function createSocket()
{
	return new WebSocket('ws://localhost:' + currentServer.address.port)
}

exports.boot = function(cb)
{
	if (currentServer)
	{
		currentServer.close()
	}
	
	config.websocket.port = 0
	config.sandbox = 'tests'
	config.clustering.enabled = false
	config.logging.verbosity = 'error'
	
	currentServer = new MetagameServer()
	co(function*()
	{
		yield currentServer.init()
		
		for (const prop in config.mongodb)
		{
			const connectionProfile = config.mongodb[prop]
			const database = util.format('%s_%s_%s', config.sandbox, currentServer.platform.name, connectionProfile.database || prop)
			const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
			const db = yield mongodb.MongoClient.connectAsync(connString)
			yield db.dropDatabase()
		}

		cb()
	}).catch(cb)
}

exports.assertError = function(error)
{
	return res =>
	{
		assert.notEqual(res.error, null, 'Expected an error, got ' + JSON.stringify(res.data))
		assert.strictEqual(res.error.name, error.name)
	}
}

exports.assertOk = function()
{
	return res =>
	{
		assert.equal(res.error, null, 'Expected no error, got ' + JSON.stringify(res.error))
	}
}

exports.authSequence = function(sequence, cb)
{
	const authStep = { path: '/auth/login', params: { userID: 'ruan', client: 'game' }, test: res => assert.strictEqual(res.data.ok, true) }
	sequence.unshift(authStep)
	exports.sequence(sequence, cb)
}

exports.serverAuthSequence = function(sequence, cb)
{
	const authStep = { path: '/auth/login', params: { server: true, client: 'game' }, test: res => assert.strictEqual(res.data.ok, true) }
	sequence.unshift(authStep)
	exports.sequence(sequence, cb)
}

exports.sequence = function(sequence, cb)
{
	const ws = createSocket()
	const tests = sequence.map(step => { return { guid: uuid.v4(), step } })
	let testIndex = 0
	let currentTest
	
	function nextTest()
	{
		currentTest = tests[testIndex]
		const step = currentTest.step
		
		testIndex++
		
		const message = { path: step.path, params: step.params, correlation: currentTest.guid }
		ws.send(JSON.stringify(message))
	}
	
	ws.on('open', () =>
	{
		nextTest()
		
		ws.on('message', message =>
		{
			const response = JSON.parse(message)
			if (response.correlation === currentTest.guid)
			{
				currentTest.step.test(response)
				if (testIndex === tests.length)
				{
					cb()
				}
				else
				{
					nextTest()
				}
			}
		})
	})
}