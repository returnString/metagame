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
			'lockFailed',
			'lockExpired',
		]}
		
		*init()
		{
			this.db = yield this.createMongoConnection('state')
			this.dataConfig = loader.require(this.config.state.data)
			this.lockTimeout = this.config.state.lockTimeout * 1000
			
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
			return yield req.collection.find({}).toArray()
		}
		
		*getAdvertised(req)
		{
			return { advertised: req.collectionConfig.advertised || {} }
		}
		
		*getInstance(req)
		{
			const result = yield req.collection.findOne({ _id: req.params.id })
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
				let instance = yield req.collection.findOne({ _id: req.params.id })
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
				
				// only commit the write if the version matches and the instance isn't locked by a transaction
				const query = {
					_id: req.params.id,
					v: requiredVersion,
					$or: [
						{ l: { $exists: false } },
						{ 'l.e': { $lt: Date.now() }},
					],
				}
				const write = yield req.collection.updateOne(query, instance, { upsert: true })
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
				yield lockedInstance.collection.updateOne({ _id: lockedInstance.instanceID, 'l.g': lockData.g }, { $unset: { l: '' } })
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
			
			const lockData = { e: Date.now() + this.lockTimeout, g: uuid.v4(), h: os.hostname() }
			const locked = []
			
			// try to acquire lock on all affected instances
			for (const targetID in instanceData)
			{
				const data = instanceData[targetID]
				const collection = data.collection
				const instanceID = data.instanceID
				
				// we can take the lock if none already exists, or the previous lock expired
				const lockQuery = {
					_id: instanceID,
					$or: [
						{ l: { $exists: false } },
						{ 'l.e': { $lt: Date.now() } },
					],
				}
				const lockUpdate = {
					$set: { l: lockData },
					$inc: { v: 1 },
				}
				
				const lockWrite = yield collection.updateOne(lockQuery, lockUpdate, { upsert: true })
				
				// if this was an upsert, run the type's ctor later rather than just attaching to __proto__
				data.wasCreated = lockWrite.upsertedCount === 1
				
				if (data.wasCreated || lockWrite.modifiedCount === 1)
				{
					locked.push({ instanceID, collection })
				}
				else
				{
					// if any instances fail to lock, clear all acquired locks and abort
					// TODO: retries
					yield this.unlock(locked, lockData)
					return this.errors.lockFailed({ instanceID })
				}
			}
			
			const targets = {}
			for (const targetID in instanceData)
			{ 
				const data = instanceData[targetID]
				
				let target
				if (data.wasCreated)
				{
					target = new data.InstanceType()
					target.v = 0
					target._id = data.instanceID
					target.l = lockData
				}
				else
				{
					// TODO: Parallelise these fetches
					target = yield data.collection.findOne({ _id: data.instanceID })
					target.__proto__ = data.InstanceType.prototype
				}
				
				target.v++
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
			
			// TODO: find a way to ensure all these writes are committed, even if the server dies midway through
			const writePromises = []
			for (const targetID in instanceData)
			{
				const data = instanceData[targetID]
				// our lock may have technically expired here, depending on how complex the transaction is
				// assert that no-one else has replaced our potentially expired lock by comparing the guids 
				// TODO: better handling of edge cases for this
				writePromises.push(data.collection.updateOne({ _id: data.instanceID, 'l.g': lockData.g }, targets[targetID]))
			}
			
			const writes = yield Promise.all(writePromises)
			const failedWrite = writes.find(w => w.modifiedCount === 0)
			yield this.unlock(locked, lockData)
			
			if (!failedWrite)
			{
				return targets
			}
			else
			{
				return this.errors.lockExpired()
			}
		}
	}
	
	return StateService
}
