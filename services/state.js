'use strict'

module.exports = function*(loader)
{
	class StateService extends loader.Service
	{
		get serviceErrors() { return [
			'instanceNotFound',
			'collectionNotFound',
			'changeNotFound',
			'changeDenied',
			'changeFailed',
			'changeContention',
		]}
		
		*init()
		{
			this.db = yield this.createMongoConnection('state')
			this.dataConfig = loader.require(this.config.state.data)
		}
		
		*getCollectionAndConfig(req)
		{
			const name = req.params.collection
			const collectionConfig = this.dataConfig.collections[name]
			if (!collectionConfig)
			{
				return this.errors.collectionNotFound(name)
			}
			
			req.collection = yield this.db.collectionAsync(name)
			req.collectionConfig = collectionConfig
		}
		
		getRoutes()
		{
			const middleware = [ this.authenticated, this.getCollectionAndConfig ]
			
			return [
				[ 'collection', this.getCollection, middleware ],
				[ 'advertised', this.getAdvertised, middleware ],
				[ 'instance', this.getInstance, middleware ],
				[ 'modify', this.modify, middleware ],
			]
		}
		
		*getCollection(req)
		{
			const findResult = yield req.collection.findAsync()
			return findResult.toArray()
		}
		
		*getAdvertised(req)
		{
			return { advertised: req.collectionConfig.advertised || {} }
		}
		
		*getInstance(req)
		{
			const result = yield req.collection.findOneAsync({ _id: req.params.id })
			if (!result)
			{
				return this.errors.instanceNotFound()
			}
			
			return result
		}
		
		*modify(req)
		{
			if (!(req.params.changes instanceof Array) || req.params.changes.length === 0)
			{
				return this.errors.messageParsingFailed('changes')
			}
			
			const changeRequests = []
			for (const changeRequest of req.params.changes)
			{
				const change = req.collectionConfig.changes[changeRequest.name]
				if (!change)
				{
					return this.errors.changeNotFound()
				}
				
				if (change.test)
				{
					const testResult = yield change.test(req.user, req.params.id)
					if (!testResult)
					{
						return this.errors.changeDenied()
					}
				}
				
				changeRequests.push({ change, params: changeRequest.params })
			}
			
			for (let attempt = 0; attempt < this.config.state.maxRetries; attempt++)
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
						return this.errors.internalError()
					}
					
					if (changeResult !== undefined)
					{
						return this.errors.changeFailed({ changeResult })
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
							return this.errors.internalError()
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
			
			return this.errors.changeContention()
		}
	}
	
	return StateService
}
