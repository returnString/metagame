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
			const tokens = sessionID.split('|')
			if (tokens.length !== 2)
			{
				return this.errors.messageParsingFailed('sessionID')
			}
			
			req.bucket = tokens[0]
			req.recordingID = tokens[1]
			req.collection = this.mongo.collection('telemetry_' + req.bucket)
		}
		
		getRoutes()
		{
			const bucket = { type: 'string' }
			const sessionID = { type: 'string' }
			const timelines = {
				type: 'array',
				name: { type: 'string' },
				object: { type: 'string' },
				entries: {
					type: 'array',
				},
			}
			
			return [
				[ 'start', this.start, [ this.authenticated, this.schema({ bucket }) ] ],
				[ 'record', this.record, [ this.authenticated, this.getCollection, this.schema({ sessionID, timelines }) ] ],
				[ 'view', this.view, [ this.authenticated, this.getCollection, this.schema({ sessionID }) ] ],
			]
		}
		
		*start(req)
		{
			const bucket = req.params.bucket
			const recordingID = uuid.v4()
			const sessionID = bucket + '|' + recordingID
			const collection = this.mongo.collection('telemetry_' + bucket)
			yield collection.insert({
				_id: recordingID,
				users: [ req.user.id ],
			})
			return { sessionID }
		}
		
		*record(req)
		{
			if (!Array.isArray(req.params.timelines) || req.params.timelines.length === 0)
			{
				return this.errors.messageParsingFailed('timelines')
			}
			
			const update = {}
			for (const timeline of req.params.timelines)
			{
				const objectName = timeline.object
				const timelineName = timeline.name
				update[objectName + '.' + timelineName] = { $each: timeline.entries }
			}
			
			const write = yield req.collection.updateOne({ _id: req.recordingID }, { $push: update })
			if (write.result.n)
			{
				return { ok: true }
			}
			else
			{
				return this.errors.recordNotFound(req.recordingID)
			}
		}
		
		*view(req)
		{
			const record = yield req.collection.findOne({ _id: req.recordingID })
			if (!record)
			{
				return this.errors.recordNotFound(req.recordingID)
			}
			
			return { record }
		}
	}
	
	return TelemetryService
}