'use strict'

const Service = require('../core/service');
const errcode = require('../core/errcode')
const config = require('../config')
const bluebird = require('bluebird')
const mongodb = require('mongodb')
bluebird.promisifyAll(mongodb)
const util = require('util')

class StateService extends Service
{
	*init()
	{
		const connString = util.format('mongodb://%s:%d/%s', config.state.mongo.host, config.state.mongo.port, config.state.mongo.database)
		this.db = yield mongodb.MongoClient.connectAsync(connString)
		this.dataConfig = require('../' + config.state.data)
	}
	
	getRoutes()
	{
		return [
			[ '/state/collection', this.getCollection, { authenticated: true } ],
			[ '/state/instance', this.getInstance, { authenticated: true } ],
			[ '/state/modify', this.modify, { authenticated: true } ],
		]
	}
	
	*getCollectionAndConfig(name)
	{
		const collectionConfig = this.dataConfig.collections[name]
		if (!collectionConfig)
		{
			return errcode.collectionNotFound(name)
		}
		
		return { collection: yield this.db.collectionAsync(name), config: collectionConfig }
	}
	
	*getCollection(req)
	{
		const data = yield this.getCollectionAndConfig(req.params.collection)
		if (data.error)
		{
			return data
		}
		
		const findResult = yield data.collection.findAsync()
		return findResult.toArray()
	}
	
	*getInstance(req)
	{
		const data = yield this.getCollectionAndConfig(req.params.collection)
		if (data.error)
		{
			return data
		}
		
		return yield data.collection.findOneAsync({ _id: req.params.id })
	}
	
	*modify(req)
	{
		const data = yield this.getCollectionAndConfig(req.params.collection)
		if (data.error)
		{
			return data
		}
		
		const changeRequests = []
		for (const changeRequest of req.params.changes)
		{
			const change = data.config.changes[changeRequest.name]
			if (!change)
			{
				return errcode.changeNotFound()
			}
			changeRequests.push({ change, params: changeRequest.params })
		}
		
		for (let attempt = 0; attempt < 5; attempt++)
		{
			let instance = yield data.collection.findOneAsync({ _id: req.params.id })
			if (!instance)
			{
				instance = new data.config.instanceType()
				instance.v = 1
				instance._id = req.params.id
			}
			
			for (const changeRequest of changeRequests)
			{
				const changeResult = yield changeRequest.change.apply(instance, changeRequest.params)
				if (changeResult instanceof this.dataConfig.errorType)
				{
					return errcode.changeFailed({ changeResult })
				}
			}
			
			const requiredVersion = instance.v
			instance.v++
			
			
			if (requiredVersion === 1)
			{
				try
				{
					yield data.collection.insertAsync(instance)
				}
				catch (err)
				{
					if (err.code === 11000)
					{
						continue
					}
					else
					{
						return errcode.internalError()
					}
				}
			}
			else
			{
				const write = yield data.collection.updateAsync({ _id: req.params.id, v: requiredVersion }, instance)
				if (write.result.n === 0)
				{
					continue
				}
			}
			
			return { instance }
		}
		
		return errcode.changeContention()
	}
}

module.exports = StateService