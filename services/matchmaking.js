'use strict'

/* TODO:
	Actual session member lists
	Max sessions sizes, per-pool
	Mapping to one 1st-party platform session ID as required 
*/

const uuid = require('node-uuid')

// if we can't resolve an IP, dump it at the north pole to match with other people we can't classify
// TODO: rethink this, maybe push these into a separate sub-pool to match amongst themselves
const northPoleCoords = [ 0, 90 ]

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
			for (const poolName in this.poolConfig.pools)
			{
				const pool = this.poolConfig.pools[poolName]
				pool.collection = this.db.collection('mm_pool_' + poolName)
				yield pool.collection.ensureIndex({ pos: '2dsphere' })
			}
		}
		
		getRoutes()
		{
			const searchSchema = {
				properties: {
					pool: { type: 'string' },
					sessionValues: { type: 'object' },
					forceCreate: { type: 'boolean' },
				},
				required: [
					'pool',
					'sessionValues',
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
			
			const mongoQuery = {}
			for (const rule of pool.must)
			{
				switch (rule.op)
				{
					case 'eq':
					{
						mongoQuery['sessionValues.' + rule.field] = sessionValues[rule.field]
					}
					break;
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
				
				const nearSessions = geoResults.results
				
				for (const session of nearSessions)
				{
					joinedSession = session.obj
					break
					// TODO: Actually join the session here, attempt a write with a predicate on remaining max space
				}
			}
			
			if (joinedSession)
			{
				return { action: 'join', sessionID: joinedSession._id }
			}
			else
			{
				const newSessionID = uuid.v4()
				joinedSession = { _id: newSessionID, pos: sessionPoint, sessionValues }
				yield pool.collection.insert(joinedSession)
				return { action: 'create', sessionID: newSessionID }
			}
		}
	}
	
	return MatchmakingService
}