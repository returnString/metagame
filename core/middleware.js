'use strict'

const errcode = require('./errcode')

exports.authenticated = function*(request)
{
	request.user = this.router.usersBySocket.get(request.socket)
	if (!request.user)
	{
		return errcode.authenticationRequired()
	}
}