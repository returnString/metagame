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
		verbosity: 'debug',
	},
	users: {
		allowedClients: [ 'game', 'companion' ],
	},
	state: {
		mongo: {
			host: '127.0.0.1',
			port: 27017,
			database: 'state',
			testDatabase: 'state_test',
		},
		data: 'test/sample_data/',
		maxRetries: 5,
	},
}