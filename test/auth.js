'use strict'

const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')

describe('auth', function()
{
	before(helpers.boot)
	
	it('should allow a user to log in, use an authenticated endpoint, and log out', function(cb)
	{
		helpers.sequence([
			{ path: '/auth/login', params: { userID: 'ruan', client: 'game', }, test: res => assert.strictEqual(res.data.ok, true) },
			{ path: '/system/info', test: res => assert.notEqual(res.data.time, null) },
			{ path: '/auth/logout', test: res => assert.strictEqual(res.data.ok, true) },
			{ path: '/system/info', test: helpers.assertError(errcode.authenticationRequired()) },
		], cb)
	})
	
	it('should fail to log in if using an invalid client', function(cb)
	{
		helpers.sequence([
			{ path: '/auth/login', params: { userID: 'ruan', client: 'invalid' }, test: helpers.assertError(errcode.invalidParam()) },
		], cb)
	})
	
	it('should fail to log out if not logged in', function(cb)
	{
		helpers.sequence([
			{ path: '/auth/logout', test: helpers.assertError(errcode.authenticationRequired()) },
		], cb)
	})
	
	it('should deny an unauthenticated user access to an authenticated endpoint', function(cb)
	{
		helpers.sequence([
			{ path: '/system/info', test: helpers.assertError(errcode.authenticationRequired()) },
		], cb)
	})
})