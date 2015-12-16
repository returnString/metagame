'use strict'

require('./setup')()
const assert = require('assert')
const helpers = require('./helpers')

describe('telemetry', function()
{
	before(helpers.boot)
	
	const testBucket = 'testBucket'
	
	it('should allow creation of timelines for objects in sessions', function*()
	{
		const ws = yield helpers.createAuthedSocket()
		const telemetryResponse = yield helpers.request(ws, '/telemetry/start', { bucket: testBucket })
		const sessionID = telemetryResponse.data.sessionID
		
		const timeline1 = [ { t: 1, }, { t: 2, }, { t: 3, } ]
		const timeline2 = [ { t: 10, eventData: 1, }, { t: 20, eventData: 2 } ]
		
		const request = {
			sessionID,
			timelines: [
				{
					object: 'testThing',
					name: 'exampleTimeline',
					entries: timeline1,
				},
				{
					object: 'anotherThing',
					name: 'secondTimeline',
					entries: timeline2,
				},
			],
		}
		
		yield helpers.request(ws, '/telemetry/record', request)
		const viewResponse = yield helpers.request(ws, '/telemetry/view', { sessionID })
		const record = viewResponse.data.record
		assert.deepEqual(record.testThing.exampleTimeline, timeline1)
		assert.deepEqual(record.anotherThing.secondTimeline, timeline2)
	})
	
	it('should return an error when writing to an invalid session', function*()
	{
		const ws = yield helpers.createAuthedSocket()
		const request = {
			sessionID: testBucket + '|invalid',
			timelines: [
				{
					object: 'test',
					name: 'testTimeline',
					entries: [ {} ],
				},
			],
		}
		yield helpers.request(ws, '/telemetry/record', request, helpers.assertError('telemetry/recordNotFound'))
	})
})