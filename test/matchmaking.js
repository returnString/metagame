'use strict'

require('./setup')()
const assert = require('assert')
const helpers = require('./helpers')

describe('matchmaking', function()
{
	before(helpers.boot)
	
	beforeEach(function*()
	{
		yield helpers.clearMongoCollections('matchmaking')
	})
	
	let rollingUserID = 0
	function* createSocket(coords)
	{
		return yield helpers.createAuthedSocket(++rollingUserID, { coords })
	}
	
	function* search(ws, pool, sessionValues, forceCreate)
	{
		return yield helpers.request(ws, '/matchmaking/search', { pool, sessionValues: sessionValues || {}, forceCreate })
	}
	
	function* expectCreate(ws, pool, sessionValues)
	{
		const searchResult = yield search(ws, pool, sessionValues)
		assert.equal(searchResult.data.action, 'create')
		return searchResult.data.sessionID
	}
	
	function* forceCreate(ws, pool, sessionValues)
	{
		const searchResult = yield search(ws, pool, sessionValues, true)
		assert.equal(searchResult.data.action, 'create')
		return searchResult.data.sessionID
	}
	
	function* expectJoin(ws, pool, sessionValues, sessionID)
	{
		const searchResult = yield search(ws, pool, sessionValues)
		assert.equal(searchResult.data.action, 'join')
		assert.equal(searchResult.data.sessionID, sessionID)
	}
	
	it('should match searching users according to a "must" rule', function*()
	{
		const ws1 = yield createSocket()
		const ws2 = yield createSocket()
		const ws3 = yield createSocket()
		const ws4 = yield createSocket()
		
		const lv1ID = yield expectCreate(ws1, 'levelPool', { level: 1 })
		const lv2ID = yield expectCreate(ws2, 'levelPool', { level: 2 })
		yield expectJoin(ws3, 'levelPool', { level: 1 }, lv1ID)
		yield expectJoin(ws4, 'levelPool', { level: 2 }, lv2ID)
	})
	
	it('should prioritise nearby sessions if all else is equal', function*()
	{
		const ws1 = yield createSocket([ 0, 0 ])
		const ws2 = yield createSocket([ 20, 0 ])
		const ws3 = yield createSocket([ 5, 0 ])
		const ws4 = yield createSocket([ 15, 0 ])
		
		const lowID = yield forceCreate(ws1, 'easyPool')
		const highID = yield forceCreate(ws2, 'easyPool')
		yield expectJoin(ws3, 'easyPool', {}, lowID)
		yield expectJoin(ws4, 'easyPool', {}, highID)
	})
	
	it('should respect max space settings per pool', function*()
	{
		const ws1 = yield createSocket()
		const ws2 = yield createSocket()
		const ws3 = yield createSocket()
		const ws4 = yield createSocket()
		const ws5 = yield createSocket()
		
		const id = yield expectCreate(ws1, 'easyPool')
		yield expectJoin(ws2, 'easyPool', {}, id)
		yield expectJoin(ws3, 'easyPool', {}, id)
		yield expectJoin(ws4, 'easyPool', {}, id)
		yield expectCreate(ws5, 'easyPool')
	})
})