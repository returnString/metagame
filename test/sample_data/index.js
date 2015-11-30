'use strict'

const errors = require('./errors')
const users = require('./users')

module.exports = {
	collections: {
		users,
	},
	ErrorType: errors.TestGameError,
}