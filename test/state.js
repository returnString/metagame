'use strict'

const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')

describe('state', function()
{
	before(helpers.boot)
	
	it('should allow a user to view a collection', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/collection', params: { collection: 'users', }, test: res => assert.deepEqual(res.data, []) },
		], cb)
	})
	
	it('should allow a user to view a specific instance', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/instance', params: { collection: 'users', id: 'test_instance' }, test: res => assert.strictEqual(res.data, null) },
		], cb)
	})
	
	it('should allow a user to modify an instance', function(cb)
	{
		const changes = [
			{
				name: 'grantCurrency',
				params: {
					currency: 100,
				},
			},
		]
		
		helpers.authSequence([
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes }, test: res => assert.strictEqual(res.data.instance.currency, 100) },
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes }, test: res => assert.strictEqual(res.data.instance.currency, 200) },
			{ path: '/state/instance', params: { collection: 'users', id: 'test_instance' }, test: res => assert.strictEqual(res.data.currency, 200) },
		], cb)
	})
})