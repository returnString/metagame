'use strict'

const errors = require('./errors')

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
	cheapItem: { cost: 100 },
	expensiveItem: { cost: 200 },
}

const buyItem = {
	apply: function*(testUser, params)
	{
		const item = items[params.itemName]
		if (!item)
		{
			return errors.itemNotFoundError
		}
		
		if (testUser.currency < item.cost)
		{
			return errors.notEnoughCurrencyError
		}
		
		testUser.currency -= item.cost
		testUser.items.push(params.itemName)
	},
	test: function(user, id)
	{
		return user.userID == id
	}
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

const setCurrency = {
	apply: function*(testUser, params)
	{
		testUser.currency = params.currency
	},
}

module.exports = {
	InstanceType: TestUser,
	changes: {
		buyItem,
		grantCurrency,
		setCurrency,
	},
	advertised: {
		items: items,
	},
}