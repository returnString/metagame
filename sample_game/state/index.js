'use strict'

const users = require('./users')
const errors = require('./errors')

const transferCurrency = {
	targets: {
		sender: users,
		recipient: users,
	},
	*test(user, targetIDs)
	{
		return user.id == targetIDs.sender
	},
	*apply(targets, params)
	{
		const sender = targets.sender
		const recipient = targets.recipient
		const amount = params.amount
		
		if (sender.currency < amount)
		{
			return errors.notEnoughCurrencyError
		}
		
		sender.currency -= amount
		recipient.currency += amount
	},
}

module.exports = {
	collections: {
		users,
	},
	transactions: {
		transferCurrency,
	},
}