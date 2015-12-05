'use strict'

require('./setup')()
const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')

describe('auth', function()
{
	before(helpers.boot)
	
	it('should allow a user to log in, use an authenticated endpoint, and log out', function*()
	{
		const ws = yield helpers.createAuthedSocket()
		yield helpers.request(ws, '/system/info', {}, res => assert.notEqual(res.data.time, null))
		yield helpers.request(ws, '/auth/logout')
		yield helpers.request(ws, '/system/info', {}, helpers.assertError(errcode.authenticationRequired()))
	})
	
	it('should fail to log in if using an invalid client', function*()
	{
		const ws = yield helpers.createSocket()
		yield helpers.request(ws, '/auth/login', { userID: 'ruan', client: 'invalid' }, helpers.assertError(errcode.invalidParam()))
	})
	
	it('should fail to log out if not logged in', function*()
	{
		const ws = yield helpers.createSocket()
		yield helpers.request(ws, '/auth/logout', {}, helpers.assertError(errcode.authenticationRequired()))
	})
	
	it('should deny an unauthenticated user access to an authenticated endpoint', function*()
	{
		const ws = yield helpers.createSocket()
		yield helpers.request(ws, '/system/info', {}, helpers.assertError(errcode.authenticationRequired()))
	})
})