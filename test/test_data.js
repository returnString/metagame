'use strict'

class TestGameError
{
	constructor(code)
	{
		this.code = code
	}
}

const ItemNotFoundError = new TestGameError(1)
const NotEnoughCurrencyError = new TestGameError(2)

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
		const item = items[params.itemName];
		if (!item)
		{
			return ItemNotFoundError
		}
		
		if (testUser.currency < item.currency)
		{
			return NotEnoughCurrencyError
		}
		
		testUser.currency -= item.currency
		testUser.items.push(params.itemName)
	},
	params: {
		itemName: String,
	}
}

const grantCurrency = {
	apply: function*(testUser, params)
	{
		testUser.currency += params.currency
	},
	params: {
		currency: Number,
	}
}

module.exports = {
	collections: {
		users: {
			instanceType: TestUser,
			changes: {
				buyItem,
				grantCurrency,
			},
		},
	},
	errorType: TestGameError,
}