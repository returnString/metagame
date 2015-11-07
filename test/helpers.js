'use strict'

const WebSocket = require('ws')
const boot = require('../boot')
const config = require('../config')
const async = require('async')
const uuid = require('node-uuid')
const assert = require('assert')

function createSocket()
{
	return new WebSocket('ws://localhost:' + config.websocket.testPort)
}

exports.boot = function(cb)
{
	config.websocket.port = config.websocket.testPort
	config.clustering.enabled = false
	config.logging.verbosity = 'error'
	boot(cb)
}

exports.assertError = function(error)
{
	return res =>
	{
		assert.equal(res.error, true)
		assert.equal(res.code, error.code)
		assert.equal(res.name, error.name)
	}
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
			var response = JSON.parse(message)
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