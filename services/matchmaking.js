'use strict'

/* TODO:
	Mapping to one 1st-party platform session ID as required
*/

const uuid = require('node-uuid')
const jsonschema = require('jsonschema')

// if we can't resolve an IP, dump it at the north pole to match with other people we can't classify
// TODO: rethink this, maybe push these into a separate sub-pool to match amongst themselves
const northPoleCoords = [ 0, 90 ]

const defaultPool = {
	querySize: 10,
	must: [],
	defaults: {},
}

const poolSchema = {
	properties: {
		maxSpaces: { type: 'int' },
	},
	required: [
		'maxSpaces',
	],
}

module.exports = function*(loader)
{
	class MatchmakingService extends loader.Service
	{
		get serviceErrors() { return [
			'poolNotFound',
			'sessionInaccessible',
		]}
		
		*init()
		{
			this.db = yield this.createMongoConnection('matchmaking')
			this.poolConfig = loader.require(this.config.matchmaking.data)
			
			const poolValidator = new jsonschema.Validator()
			for (const poolName in this.poolConfig.pools)
			{
				const pool = this.poolConfig.pools[poolName]
				for (var prop in defaultPool)
				{
					if (pool[prop] === undefined)
					{
						pool[prop] = defaultPool[prop]
					}
				}
				
				const poolResult = poolValidator.validate(pool, poolSchema)
				if (!poolResult.valid)
				{
					throw new Error(poolResult.errors)
				}
				
				pool.collection = this.db.collection(poolName)
				yield pool.collection.ensureIndex({ pos: '2dsphere' })
				yield pool.collection.ensureIndex({ lastUpdatedAt: 1 }, { expireAfterSeconds: this.config.matchmaking.sessionTTL * 60 })
			
				pool.partyCollection = this.db.collection(`${poolName}_parties`)
			}			
		}
		
		getRoutes()
		{
			const pool = { type: 'string' }
			const partyID = { type: 'string' }
			const sessionID = { type: 'string' }
			
			const searchSchema = {
				properties: {
					pool,
					sessionValues: { type: 'object' },
					members: {
						type: 'array',
						items: { type: [ 'number', 'string' ] },
					},
					partyID,
					forceCreate: { type: 'boolean' },
				},
				required: [
					'pool',
					'sessionValues',
					'members',
					'partyID',
				],
			}
			
			const pingSchema = {
				properties: {
					pool,
					partyID,
					sessionID,
				},
				required: [
					'pool',
					'partyID',
					'sessionID',
				],
			}
			
			return [
				[ 'search', this.search, [ this.authenticated, this.schema(searchSchema) ] ],
				[ 'ping', this.ping, [ this.authenticated, this.schema(pingSchema) ] ],
			]
		}
		
		*ping(req)
		{
			const poolName = req.params.pool
			const pool = this.poolConfig.pools[poolName]
			if (!pool)
			{
				return this.errors.poolNotFound(poolName)
			}
			
			const partyID = req.params.partyID
			const sessionID = req.params.sessionID
			
			const pingWrite = yield pool.collection.updateOne({
				_id: sessionID,
				['parties.' + partyID]: { $exists: true },
			},
			{
				$currentDate: { lastUpdatedAt: true },
			})
			
			if (pingWrite.result.n)
			{
				return { ok: true }
			}
			else
			{
				return this.errors.sessionInaccessible()
			}
		}
		
		*search(req)
		{
			const poolName = req.params.pool
			const pool = this.poolConfig.pools[poolName]
			if (!pool)
			{
				return this.errors.poolNotFound(poolName)
			}
			
			const sessionValues = {}
			for (const paramName in pool.defaults)
			{
				sessionValues[paramName] = req.params.sessionValues[paramName] || pool.defaults[paramName]
			}
			
			const members = req.params.members
			members.push(req.user.id)
			const partySize = members.length
			const partyID = req.params.partyID
			
			const freeSpaces = { $gte: partySize }
			const mongoQuery = {
				freeSpaces,
				['parties.' + partyID]: { $exists: false }, 
			}
			
			for (const rule of pool.must)
			{
				switch (rule.op)
				{
					case 'eq':
					{
						mongoQuery['sessionValues.' + rule.field] = sessionValues[rule.field]
					}
					break
				}
			}
			
			const geo = req.socket.geo
			// geoip gives lat/long, mongo wants long/lat
			const coordinates = geo ? [ geo.ll[1], geo.ll[0] ] : northPoleCoords
			const sessionPoint = { type: 'Point', coordinates }
			
			let joinedSession
			if (!req.params.forceCreate)
			{
				const geoResults = yield pool.collection.geoNear(sessionPoint, {
					spherical: true,
					num: pool.querySize,
					query: mongoQuery,
				})
				
				for (const sessionEntry of geoResults.results)
				{
					const session = sessionEntry.obj
					const sessionWrite = yield pool.collection.updateOne({ _id: session._id, freeSpaces },
					{
						$inc: { freeSpaces: -partySize },
						$set: { ['parties.' + partyID]: members },
						$currentDate: { lastUpdatedAt: true },
					})
					
					if (sessionWrite.result.ok)
					{
						joinedSession = session
						break
					}
				}
			}
			
			let result, sessionID
			if (joinedSession)
			{
				sessionID = joinedSession._id
				result = { action: 'join', sessionID }
			}
			else
			{
				sessionID = uuid.v4()
				joinedSession = {
					_id: sessionID,
					pos: sessionPoint,
					sessionValues,
					freeSpaces: pool.maxSpaces - partySize,
					parties: { [partyID]: members },
					lastUpdatedAt: new Date(),
				}
				yield pool.collection.insert(joinedSession)
				result = { action: 'create', sessionID }
			}
			
			const partyTrackerResult = yield pool.partyCollection.findAndModify({ _id: partyID }, [], { sessionID, partySize }, { upsert: true })
			const formerSession = partyTrackerResult.value
			if (formerSession)
			{
				yield pool.collection.update({ _id: formerSession.sessionID }, { $unset: { ['parties.' + partyID]: 1 }, $inc: { freeSpaces: formerSession.partySize } })
			}
				
			return result
		}
	}
	
	return MatchmakingService
}