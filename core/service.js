'use strict'

const util = require('util')
const mongodb = require('mongodb')
const redis = require('redis')
const ErrorContainer = require('./error').ErrorContainer

class Service
{
	constructor(options)
	{
		this.config = options.config
		this.platform = options.platform
		this.userMap = options.userMap
		this.errors = new ErrorContainer(this.name, this.config)
		if (this.serviceErrors)
		{
			for (const error of this.serviceErrors)
			{
				this.errors.register(error)
			}
		}
	}
	
	*authenticated(request)
	{
		request.user = this.userMap.usersBySocket.get(request.socket)
		if (!request.user)
		{
			return this.errors.authenticationRequired()
		}
	}
	
	*createMongoConnection(connectionName)
	{
		const connectionProfile = this.config.mongodb[connectionName]
		if (!connectionProfile)
		{
			throw new Error('Invalid connection profile: ' + connectionName)
		}
		
		const database = util.format('%s_%s_%s', this.config.sandbox, this.platform.name, connectionProfile.database || connectionName)
		const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
		return yield mongodb.MongoClient.connectAsync(connString)
	}
	
	*createRedisConnection(connectionName)
	{
		const connectionProfile = this.config.redis[connectionName]
		if (!connectionProfile)
		{
			throw new Error('Invalid connection profile: ' + connectionName)
		}
		
		const client = redis.createClient(connectionProfile.port, connectionProfile.host)
		yield client.onceAsync('connect')
		return client
	}
}

module.exports = Service