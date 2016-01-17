'use strict'

const os = require('os')
const uuid = require('node-uuid')

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
			'targetMissing',
		]}
		
		*init()
		{
			this.db = yield this.createMongoConnection('state')
			this.dataConfig = loader.require(this.config.state.data)
			for (const collectionName in this.dataConfig.collections)
			{
				this.dataConfig.collections[collectionName].name = collectionName
			}
		}
		
		*validateChanges(req)
		{
			if (!Array.isArray(req.params.changes) || req.params.changes.length === 0)
			{
				return this.errors.messageParsingFailed('changes')
			}
		}
		
		*getCollectionAndConfig(req)
		{
			const name = req.params.collection
			const collectionConfig = this.dataConfig.collections[name]
			if (!collectionConfig)
			{
				return this.errors.collectionNotFound(name)
			}
			
			req.collection = this.db.collection(name)
			req.collectionConfig = collectionConfig
		}
		
		getRoutes()
		{
			const middleware = [ this.authenticated, this.getCollectionAndConfig ]
			
			return [
				[ 'collection', this.getCollection, middleware ],
				[ 'advertised', this.getAdvertised, middleware ],
				[ 'instance', this.getInstance, middleware ],
				[ 'modify', this.modify, [ ...middleware, this.validateChanges ] ],
				[ 'transaction', this.transaction, [ this.authenticated ] ],
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
				const InstanceType = req.collectionConfig.InstanceType
				let instance = yield req.collection.findOneAsync({ _id: req.params.id })
				if (!instance)
				{
					instance = new InstanceType()
					instance.v = 0
					instance._id = req.params.id
				}
				else
				{
					instance.__proto__ = InstanceType.prototype
				}
				
				const requiredVersion = instance.v
				
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
				
				instance.v = requiredVersion + 1
				
				// only commit the write if the version matches and the instance isn't locked by a multi-update
				const write = yield req.collection.updateAsync({ _id: req.params.id, v: requiredVersion, l: { $exists: false } }, instance, { upsert: true })
				if (write.result.n === 0)
				{
					continue
				}
				
				return { instance }
			}
			
			return this.errors.changeContention()
		}
		
		*unlock(lockedList, lockData)
		{
			for (const lockedInstance of lockedList)
			{
				// only delete the lock if it matches the lock data we submitted
				yield lockedInstance.collection.updateAsync({ _id: lockedInstance.instanceID, l: lockData }, { $unset: { l: '' } })
			}
		}
		
		*transaction(req)
		{
			const changeRequest = req.params
			const change = this.dataConfig.transactions[changeRequest.name]
			if (!change)
			{
				return this.errors.changeNotFound()
			}
			
			if (typeof change.targets !== 'object')
			{
				return this.errors.messageParsingFailed('change.targets')
			}
			
			const instanceData = {}
			for (const targetID in change.targets)
			{
				const collectionConfig = change.targets[targetID]
				const collection = this.db.collection(collectionConfig.name)
				const instanceID = changeRequest.targets[targetID]
				const InstanceType = collectionConfig.InstanceType

				instanceData[targetID] = { collection, instanceID, InstanceType }
				
				if (!instanceID)
				{
					return this.errors.targetMissing(targetID)
				}
			}
			
			if (change.test)
			{
				const testResult = yield change.test(req.user, changeRequest.targets)
				if (!testResult)
				{
					return this.errors.changeDenied()
				}
			}
			
			const lockData = { t: Date.now(), g: uuid.v4(), h: os.hostname() }
			const locked = []
			
			// try to acquire lock on all affected instances
			for (const targetID in instanceData)
			{
				const data = instanceData[targetID]
				const collection = data.collection
				const instanceID = data.instanceID

				// if any instances fail to lock, clear all acquired locks and abort
				// TODO: retries
				const lockWrite = yield collection.updateAsync({ _id: instanceID, l: { $exists: false } }, { $set: { l: lockData }, $inc: { v: 1 } }, { upsert: true })
				if (lockWrite.result.n === 1)
				{
					locked.push({ instanceID, collection })
				}
				else
				{
					yield this.unlock(locked, lockData)
					return this.errors.changeContention({ instanceID })
				}
			}
			
			const targets = {}
			for (const targetID in instanceData)
			{ 
				const data = instanceData[targetID]
				const target = yield data.collection.findOneAsync({ _id: data.instanceID })
				
				// run the ctor for this instance type if this is a new instance
				// TODO: better way to handle this case
				if (target.v === 1)
				{
					var temp = new data.InstanceType()
					for (const field in temp)
					{
						target[field] = temp[field]
					}
				}
				
				// bump up the target's version and ensure we can use the target type's methods inside the change
				target.v++
				target.__proto__ = data.InstanceType.prototype
				targets[targetID] = target
			}
			
			let changeResult
			try
			{
				changeResult = yield change.apply(targets, changeRequest.params)
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
			
			for (const targetID in instanceData)
			{
				const data = instanceData[targetID]
				yield data.collection.updateAsync({ _id: data.instanceID }, targets[targetID])
			}
			
			yield this.unlock(locked, lockData)
			return targets
		}
	}
	
	return StateService
}
