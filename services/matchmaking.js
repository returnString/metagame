'use strict'

/* TODO:
	Mapping to one 1st-party platform session ID as required
	Party member support
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
			}
		}
		
		getRoutes()
		{
			const searchSchema = {
				properties: {
					pool: { type: 'string' },
					sessionValues: { type: 'object' },
					forceCreate: { type: 'boolean' },
					members: {
						type: 'array',
						item: { type: 'string' },
					},
				},
				required: [
					'pool',
					'sessionValues',
					'members',
				],
			}
			
			return [
				[ 'search', this.search, [ this.authenticated, this.schema(searchSchema) ] ],
			]
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
			
			const freeSpaces = { $gte: partySize }
			const mongoQuery = {
				freeSpaces,
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
						$push: { members: { $each: members } },
						$currentDate: { lastUpdatedAt: true },
					})
					
					if (sessionWrite.result.ok)
					{
						joinedSession = session
						break
					}
				}
			}
			
			if (joinedSession)
			{
				return { action: 'join', sessionID: joinedSession._id }
			}
			else
			{
				const newSessionID = uuid.v4()
				joinedSession = {
					_id: newSessionID,
					pos: sessionPoint,
					sessionValues,
					freeSpaces: pool.maxSpaces - partySize,
					members,
					lastUpdatedAt: new Date(),
				}
				yield pool.collection.insert(joinedSession)
				return { action: 'create', sessionID: newSessionID }
			}
		}
	}
	
	return MatchmakingService
}