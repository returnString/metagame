'use strict'

module.exports = {
	version: 'unknown',
	debug: false,
	platform: 'debug',
	websocket: {
		port: 1337,
		testPort: 1338,
	},
	clustering: {
		enabled: true,
		workersPerCore: 1,
	},
	logging: {
		verbosity: 'info',
	},
	users: {
		allowedClients: [ 'game', 'companion' ]
	}
}