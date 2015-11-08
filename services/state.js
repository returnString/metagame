'use strict'

const Service = require('../core/service');
const errcode = require('../core/errcode')
const config = require('../config')
const mongodb = require('co-mongo')
const util = require('util')

class StateService extends Service
{
	*init()
	{
		const connString = util.format('mongodb://%s:%d/%s', config.state.mongo.host, config.state.mongo.port, config.state.mongo.database)
		this.db = yield mongodb.MongoClient.connect(connString)
	}
	
	getRoutes()
	{
		return [
			[ '/state/collection', this.getCollection, { authenticated: true } ],
			[ '/state/instance', this.getInstance, { authenticated: true } ],
		]
	}
	
	*getCollection(req)
	{
		const collection = yield this.db.collection(req.params.collection)
		return yield collection.find().toArray()
	}
	
	*getInstance(req)
	{
		const collection = yield this.db.collection(req.params.collection)
		return yield collection.findOne({ _id: req.params.id })
	}
}

module.exports = StateService