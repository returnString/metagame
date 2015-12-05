'use strict'

class MetagameError
{
	constructor(name, data, stack)
	{
		this.name = name
		this.data = data
		
		if (stack)
		{
			this.stack = new Error().stack
		}
	}
}

class ErrorContainer
{
	constructor(name, config)
	{
		this.name = name
		this.config = config
		
		const core = [
			'internalError',
			'authenticationRequired',
			'invalidParam',
			'messageParsingFailed',
		]
		
		for (const error of core)
		{
			this.registerBase('core', error)
		}
	}
	
	registerBase(prefix, errorName)
	{
		this[errorName] = data => new MetagameError(prefix + '/' + errorName, data, this.config.debug)
	}
	
	register(errorName)
	{
		this.registerBase(this.name, errorName)
	}
}

exports.MetagameError = MetagameError
exports.ErrorContainer = ErrorContainer