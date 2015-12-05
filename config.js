'use strict'

module.exports = {
	// enables stacktraces in responses
	debug: false,
	platform: 'platforms/debug',
	sandbox: 'default',
	websocket: {
		port: 1337,
	},
	clustering: {
		// enables multiple worker processes for cpu-bound loads
		enabled: true,
		// multiplied by processor count to determine worker count
		workersPerCore: 1,
	},
	logging: {
		verbosity: 'debug',
	},
	users: {
		allowedClients: [ 'game', 'companion' ],
	},
	mongodb: {
		state: {
			host: '127.0.0.1',
			port: 27017,
		},
	},
	redis: {
	},
	state: {
		data: 'test/sample_data/',
		// the maximum number of retries for optimistic locking on state changes
		maxRetries: 5,
	},
}