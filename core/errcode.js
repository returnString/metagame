'use strict'

const util = require('util')
const config = require('../config')

// Force intellisense to play nicely
const f = (data) => new MetagameError()

const errorCodes = {
	routeNotFound: f,
	authenticationRequired: f,
	messageParsingFailed: f,
	invalidParam: f,
}

const errorNames = new Map()
let i = 0
for (const name in errorCodes)
{
	const code = ++i
	errorNames[code] = name
	errorCodes[name] = (data) => new MetagameError(code, name, data)
}

class MetagameError
{
	constructor(code, name, data)
	{
		this.code = code
		this.name = name
		this.data = data
		
		if (config.debug)
		{
			this.stack = new Error().stack
		}
	}
}

module.exports = errorCodes
module.exports.MetagameError = MetagameError