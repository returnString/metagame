'use strict'

const users = require('./users')
const errors = require('./errors')
const transactions = Object.assign({}, require('./user_transactions'))

module.exports = {
	collections: {
		users,
	},
	transactions,
}