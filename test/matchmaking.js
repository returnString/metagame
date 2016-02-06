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
	let rollingPartyID = 0
	function* createSocket(coords)
	{
		return yield helpers.createAuthedSocket(++rollingUserID, { coords })
	}
	
	const auto = Symbol()
	
	function* search(ws, pool, sessionValues, forceCreate, partyID)
	{
		if (!partyID) partyID = 'party_' + ++rollingPartyID
		if (ws === auto) ws = yield createSocket()
		return yield helpers.request(ws, '/matchmaking/search', { pool, sessionValues: sessionValues || {}, forceCreate, members: [], partyID })
	}
	
	function* expectCreate(ws, pool, sessionValues, partyID)
	{
		const searchResult = yield search(ws, pool, sessionValues, false, partyID)
		assert.equal(searchResult.data.action, 'create')
		return searchResult.data.sessionID
	}
	
	function* forceCreate(ws, pool, sessionValues, partyID)
	{
		const searchResult = yield search(ws, pool, sessionValues, true, partyID)
		assert.equal(searchResult.data.action, 'create')
		return searchResult.data.sessionID
	}
	
	function* expectJoin(ws, pool, sessionValues, sessionID, partyID)
	{
		const searchResult = yield search(ws, pool, sessionValues, false, partyID)
		assert.equal(searchResult.data.action, 'join')
		if (sessionID)
		{
			assert.equal(searchResult.data.sessionID, sessionID)
		}
	}
	
	it('should match searching users according to a "must" rule', function*()
	{
		const lv1ID = yield expectCreate(auto, 'levelPool', { level: 1 })
		const lv2ID = yield expectCreate(auto, 'levelPool', { level: 2 })
		yield expectJoin(auto, 'levelPool', { level: 1 }, lv1ID)
		yield expectJoin(auto, 'levelPool', { level: 2 }, lv2ID)
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
		const id = yield expectCreate(auto, 'easyPool')
		yield expectJoin(auto, 'easyPool', {}, id)
		yield expectJoin(auto, 'easyPool', {}, id)
		yield expectJoin(auto, 'easyPool', {}, id)
		yield expectCreate(auto, 'easyPool')
	})
	
	it('should prevent a party rejoining the same session before leaving', function*()
	{
		const ws = yield createSocket()
		const partyID = 'rejoining_party'
		yield expectCreate(ws, 'easyPool', {}, partyID)
		yield expectCreate(ws, 'easyPool', {}, partyID)
	})
	
	it('should allow a party to ping a session', function*()
	{
		const ws = yield createSocket()
		const partyID = 'pinging_party'
		const pool = 'easyPool'
		const sessionID = yield expectCreate(ws, pool, {}, partyID)
		yield helpers.request(ws, '/matchmaking/ping', { pool, sessionID, partyID })
	})
	
	it('should prevent a party from pinging an unowned session', function*()
	{
		const ws = yield createSocket()
		const partyID = 'pinging_party'
		const pool = 'easyPool'
		yield expectCreate(ws, pool, {}, partyID)
		yield helpers.request(ws, '/matchmaking/ping', { pool, sessionID: 'nonexistent_sessionID', partyID }, helpers.assertError('matchmaking/sessionInaccessible'))
	})
})