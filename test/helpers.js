'use strict'

const WebSocket = require('ws')
const boot = require('../boot')
const config = require('../config')
const async = require('async')
const uuid = require('node-uuid')
const assert = require('assert')
const mongodb = require('mongodb')
const util = require('util')

let currentPort = config.websocket.testPort

function createSocket()
{
	return new WebSocket('ws://localhost:' + config.websocket.port)
}

exports.boot = function(cb)
{
	config.websocket.port = ++currentPort
	config.state.mongo.database = config.state.mongo.testDatabase
	config.clustering.enabled = false
	config.logging.verbosity = 'error'
	
	boot(function()
	{
		const connString = util.format('mongodb://%s:%d/%s', config.state.mongo.host, config.state.mongo.port, config.state.mongo.testDatabase)
		mongodb.MongoClient.connect(connString, function(err, db)
		{
			if (err) throw err
			db.dropDatabase(function(err)
			{
				if (err) throw err
				cb()
			})
		})
	})
}

exports.assertError = function(error)
{
	return res =>
	{
		assert.notEqual(res.error, null)
		assert.strictEqual(res.error.name, error.name)
	}
}

exports.authSequence = function(sequence, cb)
{
	const authStep = { path: '/auth/login', params: { userID: 'ruan', client: 'game', }, test: res => assert.strictEqual(res.data.ok, true) }
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