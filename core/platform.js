'use strict'

function notImplemented(name)
{
	throw new Error('Not implemented: ' + name)
}

class Platform
{
	*authenticate(req)
	{
		notImplemented('authenticate')
	}
}

module.exports = Platform