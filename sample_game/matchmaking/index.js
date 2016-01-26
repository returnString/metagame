'use strict'

const matchLevel = { op: 'eq', field: 'level' }

const levelPool = {
	defaults: {
		level: 1,
	},
	must: [
		matchLevel,
	],
}

const easyPool = {
}

module.exports = {
	pools: {
		levelPool,
		easyPool,
	},
}