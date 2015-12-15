'use strict'

const uuid = require('node-uuid')

module.exports = function*(loader)
{
	class TelemetryService extends loader.Service
	{
		get serviceErrors() { return [
			'recordNotFound',
		]}
		
		*init()
		{
			this.mongo = yield this.createMongoConnection('telemetry')
		}
		
		*getCollection(req)
		{
			const sessionID = req.params.sessionID
			if (!sessionID || typeof sessionID !== 'string')
			{
				return this.errors.messageParsingFailed('sessionID')
			}
			
			const tokens = sessionID.split('|')
			if (tokens.length !== 2)
			{
				return this.errors.messageParsingFailed('sessionID')
			}
			
			req.bucket = tokens[0]
			req.recordingID = tokens[1]
			req.collection = yield this.mongo.collectionAsync('telemetry_' + req.bucket)
		}
		
		getRoutes()
		{
			return [
				[ 'start', this.start, [ this.authenticated ] ],
				[ 'record', this.record, [ this.authenticated, this.getCollection ] ],
				[ 'view', this.view, [ this.authenticated, this.getCollection ] ],
			]
		}
		
		*start(req)
		{
			const bucket = req.params.bucket || 'unknown'
			const recordingID = uuid.v4()
			const sessionID = bucket + '|' + recordingID
			const collection = yield this.mongo.collectionAsync('telemetry_' + bucket)
			yield collection.insertAsync({
				_id: recordingID,
				users: [ req.user.id ],
			})
			return { sessionID }
		}
		
		*record(req)
		{
			if (!Array.isArray(req.params.timelines))
			{
				return this.errors.messageParsingFailed('timelines')
			}
			
			let update = {}
			for (const timeline of req.params.timelines)
			{
				const objectName = timeline.object
				const timelineName = timeline.name
				update[objectName + '.' + timelineName] = { $each: timeline.entries }
			}
			
			yield req.collection.updateOneAsync({ _id: req.recordingID }, { $push: update })
			return { ok: true }
		}
		
		*view(req)
		{
			const record = yield req.collection.findOneAsync({ _id: req.recordingID })
			if (!record)
			{
				return this.errors.recordNotFound(req.recordingID)
			}
			
			return { record }
		}
	}
	
	return TelemetryService
}