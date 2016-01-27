'use strict'

const matchLevel = { op: 'eq', field: 'level' }
const maxSpaces = 4

const levelPool = {
	maxSpaces,
	defaults: {
		level: 1,
	},
	must: [
		matchLevel,
	],
}

const easyPool = {
	maxSpaces,
}

module.exports = {
	pools: {
		levelPool,
		easyPool,
	},
}