'use strict'

const utils = require('./utils')

function notImplemented(name)
{
	throw new Error('Not implemented: ' + name)
}

class Platform
{
	get name() { return utils.detectName(this, 'platform') }

	*authenticate(req)
	{
		notImplemented('authenticate')
	}
}

module.exports = Platform