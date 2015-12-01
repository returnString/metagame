'use strict'

const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')
const sample = require('./sample_data')

describe('state', function()
{
	before(helpers.boot)
	
	describe('collections', function()
	{
		it('should allow a user to view a collection', function(cb)
		{
			helpers.authSequence([
				{ path: '/state/collection', params: { collection: 'users', }, test: res => assert.deepEqual(res.data, []) },
			], cb)
		})
		
		it('should return an error for a collection that does not exist', function(cb)
		{
			helpers.authSequence([
				{ path: '/state/collection', params: { collection: 'doesntexist', }, test: helpers.assertError(errcode.collectionNotFound()) },
			], cb)
		})
		
		it('should include advertised info for collections', function(cb)
		{
			helpers.authSequence([
				{ path: '/state/advertised', params: { collection: 'users' }, test: res => assert.deepEqual(res.data.advertised, sample.collections.users.advertised) }
			], cb)
		})
	})
	
	describe('modification', function()
	{
			const grantCurrencyChanges = [
			{
				name: 'grantCurrency',
				params: {
					currency: 100,
				},
			},
		]
		
		function setCurrencyRequest(currency)
		{
			return [
				{
					name: 'setCurrency',
					params: {
						currency,
					},
				},
			]
		}
		
		function modify(options)
		{
			return {
				path: '/state/modify',
				params: {
					collection: options.collection || 'users',
					id: options.id || 'test_instance',
					changes: options.changes,
				},
				test: options.test || helpers.assertOk(),
			}
		}
		
		it('should allow a user to modify an instance with the correct privileges', function(cb)
		{
			helpers.serverAuthSequence([
				modify({ changes: grantCurrencyChanges, test: res => assert.strictEqual(res.data.instance.currency, 100) }),
				modify({ changes: grantCurrencyChanges, test: res => assert.strictEqual(res.data.instance.currency, 200) }),
			], cb)
		})
		
		it('should persist changes across connections', function(cb)
		{
			helpers.authSequence([
				{ path: '/state/instance', params: { collection: 'users', id: 'test_instance' }, test: res => assert.strictEqual(res.data.currency, 200) },
			], cb)
		})
		
		it('should return an error for an instance that does not exist', function(cb)
		{
			helpers.authSequence([
				{ path: '/state/instance', params: { collection: 'users', id: 'doesntexist' }, test: helpers.assertError(errcode.instanceNotFound()) },
			], cb)
		})
		
		it('should reject a request to modify an instance which triggers a game-defined error', function(cb)
		{
			const invalidItemRequest = [
				{
					name: 'buyItem',
					params: {
						itemName: 'doesntexist',
					},
				},
			]
			
			const notEnoughMoneyRequest = [
				{
					name: 'buyItem',
					params: {
						itemName: 'cheapItem',
					},
				},
			]
			
			helpers.serverAuthSequence([
				modify({ changes: invalidItemRequest, test: helpers.assertError(errcode.changeFailed()) }),
				modify({ changes: setCurrencyRequest(0), test: res => assert.strictEqual(res.data.instance.currency, 0) }),
				modify({ changes: notEnoughMoneyRequest, test: helpers.assertError(errcode.changeFailed()) }),
			], cb)
		})
		
		it('should reject a request to modify an instance without the correct privileges', function(cb)
		{
			helpers.authSequence([
				modify({ changes: grantCurrencyChanges, test: helpers.assertError(errcode.changeDenied()) })
			], cb)
		})
		
		it('should reject a request to modify an instance with a malformed change list', function(cb)
		{
			function invalidRequest(changes)
			{
				return modify({ changes, test: helpers.assertError(errcode.messageParsingFailed())})
			}
			
			helpers.authSequence([
				invalidRequest(1),
				invalidRequest(''),
				invalidRequest({}),
			], cb)
		})
	})
})