'use strict'

const assert = require('assert')
const helpers = require('./helpers')

describe('auth', function()
{
	before(helpers.boot)
	
	it('should allow a user to authenticate and then use an authenticated endpoint', function(cb)
	{
		helpers.sequence([
			{ path: '/auth', params: { userID: 'ruan' }, test: res =>  assert.equal(res.data.ok, true) },
			{ path: '/system/time', test: res => assert(res.data.time) },
		], cb)
	})
})