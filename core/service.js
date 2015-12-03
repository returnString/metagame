'use strict'

const errcode = require('./errcode')
const config = require('../config')
const util = require('util')
const mongodb = require('mongodb')

class Service
{
	constructor(options)
	{
		this.log = options.log
		this.platform = options.platform
		this.router = options.router
	}
	
	*authenticated(request)
	{
		request.user = this.router.usersBySocket.get(request.socket)
		if (!request.user)
		{
			return errcode.authenticationRequired()
		}
	}
	
	*createMongoConnection(connectionName)
	{
		const connectionProfile = config.mongodb[connectionName]
		if (!connectionProfile)
		{
			throw new Error('Invalid connection profile: ' + connectionName)
		}
		
		const database = util.format('%s_%s_%s', config.sandbox, this.platform.name, connectionProfile.database || connectionName)
		const connString = util.format('mongodb://%s:%d/%s', connectionProfile.host, connectionProfile.port, database)
		return yield mongodb.MongoClient.connectAsync(connString)
	}
}

module.exports = Service