'use strict'

var errors = require('./errors')

class TestUser
{
	constructor()
	{
		this.name = ''
		this.currency = 0
		this.items = []
	}
}

const items = {
	cheapItem: 100,
	expensiveItem: 200,
}

const buyItem = {
	apply: function*(testUser, params)
	{
		const item = items[params.itemName]
		if (!item)
		{
			return errors.itemNotFoundError
		}
		
		if (testUser.currency < item.currency)
		{
			return errors.notEnoughCurrencyError
		}
		
		testUser.currency -= item.currency
		testUser.items.push(params.itemName)
	},
}

const grantCurrency = {
	apply: function*(testUser, params)
	{
		testUser.currency += params.currency
	},
	test: function(user)
	{
		return user.privileges.server
	},
}

module.exports = {
	InstanceType: TestUser,
	changes: {
		buyItem,
		grantCurrency,
	},
}