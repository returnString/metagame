'use strict'

var errors = require('./errors')
var users = require('./users')

module.exports = {
	collections: {
		users,
	},
	ErrorType: errors.TestGameError,
}