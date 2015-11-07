'use strict'

module.exports = {
	platform: 'debug',
	websocket: {
		port: 1337,
	},
	clustering: {
		enabled: true,
		workersPerCore: 1,
	}
}