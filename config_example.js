'use strict'

module.exports = {
	// enables stacktraces in responses
	debug: false,
	// path to your platform module 
	platform: 'platforms/debug',
	// if you want to run multiple instances on one DB, make sure each one uses a different sandbox
	// the tests run in the 'tests' sandbox
	sandbox: 'default',
	websocket: {
		// port for ws:// connections
		port: 1337,
		ssl: {
			// if enabled, metagame will also accept secure connections
			// you should use this if *anything* is sent over a public network
			enabled: true,
			// port for wss:// connections
			port: 1338,
			// the public certificate for SSL
			cert: 'keys/metagame_cert.pem',
			// the private key for SSL; keep this file secure!
			key: 'keys/metagame_key.pem',
		},
	},
	// all these service modules will be loaded on startup
	// you can specify relative or absolute paths
	services: [
		'services/auth',
		'services/state',
		'services/system',
	],
	clustering: {
		// enables multiple worker processes for cpu-bound loads
		enabled: true,
		// multiplied by processor count to determine worker count
		workersPerCore: 1,
	},
	logging: {
		// the minimum log level to output
		verbosity: 'debug',
	},
	users: {
		// the allowed client types for authentication
		allowedClients: [ 'game', 'companion' ],
	},
	// these config sections can be referenced inside services to create mongodb connections
	mongodb: {
		state: {
			host: '127.0.0.1',
			port: 27017,
		},
	},
	// these config sections can be referenced inside services to create redis connections
	redis: {
	},
	state: {
		// the module from which the state service loads the collection list
		data: 'test/sample_data/',
		// the maximum number of retries for optimistic locking on state changes
		maxRetries: 5,
	},
}