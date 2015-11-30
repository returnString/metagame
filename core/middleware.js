'use strict'

const errcode = require('./errcode')

exports.authenticated = function*(request, router)
{
	request.user = router.usersBySocket.get(request.socket)
	if (!request.user)
	{
		return errcode.authenticationRequired()
	}
}