'use strict'

require('./setup')()
const assert = require('assert')
const helpers = require('./helpers')
const errcode = require('../core/errcode')
const sample = require('./sample_data')

describe('state', function()
{
	before(helpers.boot)
	
	describe('collections', function()
	{
		it('should allow a user to view a collection', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield helpers.request(ws, '/state/collection', { collection: 'users' }, res => assert.deepEqual(res.data, []))
		})
		
		it('should return an error for a collection that does not exist', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield helpers.request(ws, '/state/collection', { collection: 'doesntexist' }, helpers.assertError(errcode.collectionNotFound()))
		})
		
		it('should include advertised info for collections', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield helpers.request(ws, '/state/advertised', { collection: 'users' },
				res => assert.deepEqual(res.data.advertised, sample.collections.users.advertised))
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
		
		function buyItemRequest(itemName)
		{
			return [
				{
					name: 'buyItem',
					params: {
						itemName,
					},
				},
			]
		}
		
		function* modify(ws, options, tests)
		{
			const params = {
				collection: options.collection || 'users',
				id: options.id || 'ruan',
				changes: options.changes,
			}
			
			yield helpers.request(ws, '/state/modify', params, tests)
		}
		
		it('should allow a user to modify an instance with the correct privileges', function*()
		{
			const ws = yield helpers.createServerSocket()
			yield modify(ws, { changes: grantCurrencyChanges }, res => assert.strictEqual(res.data.instance.currency, 100))
			yield modify(ws, { changes: grantCurrencyChanges }, res => assert.strictEqual(res.data.instance.currency, 200))
		})
		
		it('should persist changes across connections', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield helpers.request(ws, '/state/instance', { collection: 'users', id: 'ruan' }, res => assert.strictEqual(res.data.currency, 200))
		})
		
		it('should return an error for an instance that does not exist', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield helpers.request(ws, '/state/instance', { collection: 'users', id: 'doesntexist' }, helpers.assertError(errcode.instanceNotFound()))
		})
		
		it('should reject a request to modify an instance which triggers a game-defined error', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield modify(ws, { changes: buyItemRequest('doesntexist') }, helpers.assertError(errcode.changeFailed()))
			yield modify(ws, { changes: setCurrencyRequest(0) }, res => assert.strictEqual(res.data.instance.currency, 0))
			yield modify(ws, { changes: buyItemRequest('cheapItem') }, helpers.assertError(errcode.changeFailed()))
		})
		
		it('should reject a request to modify an instance without the correct privileges', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield modify(ws, { changes: grantCurrencyChanges }, helpers.assertError(errcode.changeDenied()))
		})
		
		it('should reject a request to modify an instance without the correct ID-based privilege', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			yield modify(ws, { changes: buyItemRequest('cheapItem'), id: 'notme' }, helpers.assertError(errcode.changeDenied()))
		})
		
		it('should reject a request to modify an instance with a malformed change list', function*()
		{
			const ws = yield helpers.createAuthedSocket()
			function* invalidRequest(changes)
			{
				yield modify(ws, { changes }, helpers.assertError(errcode.messageParsingFailed()))
			}
			
			yield invalidRequest(1)
			yield invalidRequest('')
			yield invalidRequest({})
		})
	})
})