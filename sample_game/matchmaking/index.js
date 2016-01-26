'use strict'

const matchLevel = { op: 'eq', field: 'level' }

const levelPool = {
	querySize: 10,
	defaults: {
		level: 1,
	},
	must: [
		matchLevel,
	],
}

const easyPool = {
	querySize: 10,
	defaults: {},
	must: [],
}

module.exports = {
	pools: {
		levelPool,
		easyPool,
	},
}