'use strict'

const util = require('util')
const mongodb = require('mongodb')
const redis = require('redis')
const ErrorContainer = require('./error').ErrorContainer
const utils = require('./utils')
const jsonschema = require('jsonschema')

class Service
{
	get name() { return utils.detectName(this, 'service') }
	
	constructor(options)
	{
		this.config = options.config
		this.platform = options.platform
		this.userMap = options.userMap
		this.errors = new ErrorContainer(this.name, this.config)
		this.schemaValidator = new jsonschema.Validator()
		
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
	
	schema(requestSchema)
	{
		const fullSchema = { properties: requestSchema }
		function* validate(request)
		{
			const result = this.schemaValidator.validate(request.params, fullSchema)
			if (!result.valid)
			{
				return this.errors.messageParsingFailed(result)
			}
		}
		
		validate.data = requestSchema
		validate.desc = 'request format'
		return validate
	}
	
	*createMongoConnection(connectionName)
	{
		const connectionProfile = this.config.mongodb.connections[connectionName]
		if (!connectionProfile)
		{
			throw new Error('Invalid connection profile: ' + connectionName)
		}
		
		const database = util.format('%s_%s_%s', this.config.sandbox, this.platform.name, connectionProfile.database || connectionName)
		const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
		
		const w = connectionProfile.writeConcern || this.config.mongodb.defaultWriteConcern || 'majority'
		return yield mongodb.MongoClient.connect(connString, { db: { w } })
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