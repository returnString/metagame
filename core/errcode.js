'use strict'

const util = require('util')
const config = require('../config')

// Force intellisense to play nicely
const f = (data) => new MetagameError()

const errorCodes = {
	internalError: f,
	routeNotFound: f,
	authenticationRequired: f,
	messageParsingFailed: f,
	invalidParam: f,
	collectionNotFound: f,
	instanceNotFound: f,
	changeNotFound: f,
	changeFailed: f,
	changeContention: f,
	changeDenied: f,
}

for (const name in errorCodes)
{
	errorCodes[name] = (data) => new MetagameError(name, data)
}

class MetagameError
{
	constructor(name, data)
	{
		this.name = name
		this.data = data
		this.error = true
		
		if (config.debug)
		{
			this.stack = new Error().stack
		}
	}
}

module.exports = errorCodes
module.exports.MetagameError = MetagameError