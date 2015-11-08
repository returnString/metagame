'use strict'

const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')

describe('state', function()
{
	before(helpers.boot)
	
	it('should allow us to view a collection', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/collection', params: { collection: 'test', }, test: res => assert.deepEqual(res.data, []) },
		], cb)
	})
	
	it('should allow us to view a specific instance', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/instance', params: { collection: 'test', id: 'test_instance' }, test: res => assert.strictEqual(res.data, null) },
		], cb)
	})
})