'use strict'

function notImplemented(name)
{
	throw new Error('Not implemented: ' + arguments.callee.caller.name)
}

class Platform
{
	*authenticate(req)
	{
		notImplemented()
	}
}

module.exports = Platform