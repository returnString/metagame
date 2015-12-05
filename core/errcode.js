'use strict'

let debug

const errorCodes = {
	internalError: 1,
	routeNotFound: 2,
	authenticationRequired: 3,
	messageParsingFailed: 4,
	invalidParam: 5,
	collectionNotFound: 6,
	instanceNotFound: 7,
	changeNotFound: 8,
	changeFailed: 9,
	changeContention: 10,
	changeDenied: 11,
}

for (const name in errorCodes)
{
	const code = errorCodes[name]
	exports[name] = (data) => new MetagameError(code, name, data)
}

class MetagameError
{
	constructor(code, name, data)
	{
		this.code = code
		this.name = name
		this.data = data
		
		if (debug)
		{
			this.stack = new Error().stack
		}
	}
}

exports.MetagameError = MetagameError
exports.init = function(config)
{
	debug = config.debug
}