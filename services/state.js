'use strict'

const Service = require('../core/service')
const errcode = require('../core/errcode')
const config = require('../config')
const bluebird = require('bluebird')
const mongodb = require('mongodb')
bluebird.promisifyAll(mongodb)
const util = require('util')
const middleware = require('../core/middleware')

class StateService extends Service
{
	*init()
	{
		const connString = util.format('mongodb://%s:%d/%s', config.state.mongo.host, config.state.mongo.port, config.state.mongo.database)
		this.db = yield mongodb.MongoClient.connectAsync(connString)
		this.dataConfig = require('../' + config.state.data)
		if (!this.dataConfig.ErrorType)
		{
			throw new Error('State config must include ErrorType')
		}
	}
	
	*getCollectionAndConfig(req)
	{
		const name = req.params.collection
		const collectionConfig = this.dataConfig.collections[name]
		if (!collectionConfig)
		{
			return errcode.collectionNotFound(name)
		}
		
		req.collection = yield this.db.collectionAsync(name)
		req.collectionConfig = collectionConfig
	}
	
	getRoutes()
	{
		return [
			[ '/state/collection', this.getCollection, [ middleware.authenticated, this.getCollectionAndConfig ] ],
			[ '/state/instance', this.getInstance, [ middleware.authenticated, this.getCollectionAndConfig ] ],
			[ '/state/modify', this.modify, [ middleware.authenticated, this.getCollectionAndConfig ] ],
		]
	}
	
	*getCollection(req)
	{
		const findResult = yield req.collection.findAsync()
		return findResult.toArray()
	}
	
	*getInstance(req)
	{
		const result = yield req.collection.findOneAsync({ _id: req.params.id })
		if (!result)
		{
			return errcode.instanceNotFound()
		}
		
		return result
	}
	
	*modify(req)
	{
		if (!(req.params.changes instanceof Array))
		{
			return errcode.messageParsingFailed()
		}
		
		const changeRequests = []
		for (const changeRequest of req.params.changes)
		{
			const change = req.collectionConfig.changes[changeRequest.name]
			if (!change)
			{
				return errcode.changeNotFound()
			}
			
			if (change.test)
			{
				if (!change.test(req.user))
				{
					return errcode.changeDenied()
				}
			}
			
			changeRequests.push({ change, params: changeRequest.params })
		}
		
		for (let attempt = 0; attempt < config.state.maxRetries; attempt++)
		{
			let instance = yield req.collection.findOneAsync({ _id: req.params.id })
			if (!instance)
			{
				instance = new req.collectionConfig.InstanceType()
				instance.v = 1
				instance._id = req.params.id
			}
			
			for (const changeRequest of changeRequests)
			{
				let changeResult
				try
				{
					changeResult = yield changeRequest.change.apply(instance, changeRequest.params)
				}
				catch (err)
				{
					this.log.error(err, 'change application error')
					return errcode.internalError()
				}
				
				if (changeResult instanceof this.dataConfig.ErrorType)
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
					yield req.collection.insertAsync(instance)
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
				const write = yield req.collection.updateAsync({ _id: req.params.id, v: requiredVersion }, instance)
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