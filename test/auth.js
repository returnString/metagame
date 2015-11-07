'use strict'

const assert = require('assert')
const helpers = require('./helpers')

let createSocket

describe('auth', function()
{
	before(cb =>
	{
		helpers.boot(func => 
		{
			createSocket = func
			cb()
		})
	})
	
	function auth(userID, cb)
	{
		const ws = createSocket()
		ws.on('open', () =>
		{
			const params = { path: '/auth', params: { userID } }
			ws.send(JSON.stringify(params))
		})
		
		ws.on('message', message =>
		{
			const response = JSON.parse(message)
			assert.equal(response.data.ok, true)
			cb()
		})
	}
	
	it('should allow a user to authenticate', function(cb)
	{
		auth('test user', cb)
	})
})