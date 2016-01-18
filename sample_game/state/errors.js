'use strict'

class TestGameError
{
	constructor(code)
	{
		this.code = code
	}
}

exports.TestGameError = TestGameError
exports.itemNotFoundError = new TestGameError(1)
exports.notEnoughCurrencyError = new TestGameError(2)