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
	
	it('should return an error for a collection that does not exist', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/collection', params: { collection: 'doesntexist', }, test: helpers.assertError(errcode.collectionNotFound()) },
		], cb)
	})
	
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
	
	it('should allow a user to modify an instance with the correct privileges', function(cb)
	{
		helpers.serverAuthSequence([
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: grantCurrencyChanges }, test: res => assert.strictEqual(res.data.instance.currency, 100) },
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: grantCurrencyChanges }, test: res => assert.strictEqual(res.data.instance.currency, 200) },
		], cb)
	})
	
	it('should allow a user to view a specific instance', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/instance', params: { collection: 'users', id: 'test_instance' }, test: res => assert.strictEqual(res.data.currency, 200) },
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
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: invalidItemRequest }, test: helpers.assertError(errcode.changeFailed()) },
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: setCurrencyRequest(0) }, test: res => assert.strictEqual(res.data.instance.currency, 0) },
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: notEnoughMoneyRequest }, test: helpers.assertError(errcode.changeFailed()) },
		], cb)
	})
	
	it('should reject a request to modify an instance without the correct privileges', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: grantCurrencyChanges }, test: helpers.assertError(errcode.changeDenied()) },
		], cb)
	})
	
	it('should reject a request to modify an instance with a malformed change list', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/modify', params: { collection: 'users', id: 'test_instance', changes: 1 }, test: helpers.assertError(errcode.messageParsingFailed()) },
		], cb)
	})
		
	it('should return an error for an instance that does not exist', function(cb)
	{
		helpers.authSequence([
			{ path: '/state/instance', params: { collection: 'users', id: 'doesntexist' }, test: helpers.assertError(errcode.instanceNotFound()) },
		], cb)
	})
})