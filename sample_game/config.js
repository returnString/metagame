'use strict'

module.exports = {
	// enables stacktraces in responses
	debug: false,
	// path to your platform module 
	platform: 'platforms/debug',
	// if you want to run multiple instances on one DB, make sure each one uses a different sandbox
	// the tests run in the 'tests' sandbox
	sandbox: 'default',
	server: {
		bind: '0.0.0.0',
		// port for insecure connections
		port: 1337,
		// set this to true if you want to trust x-forwarded-for headers for client IP addresses
		proxied: false,
		tls: {
			// if enabled, metagame will also accept secure connections
			// you should use this if *anything* is sent over a public network
			enabled: true,
			// port for secure connections
			port: 1338,
			// the public certificate for SSL
			cert: 'sample_game/keys/metagame_cert.pem',
			// the private key for SSL; keep this file secure!
			key: 'sample_game/keys/metagame_key.pem',
		},
	},
	
	services: {
		// core services to load
		core: [
			'auth',
			'state',
			'system',
			'telemetry',
			'matchmaking',
		],
		// all these service modules will be loaded on startup
		// you can specify relative or absolute paths
		custom: [
		],
	},
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
	geolocation: {
		enabled: true,
		// allows clients to override their geolocated data
		allowOverride: false,
	},
	// these config sections can be referenced inside services to create mongodb connections
	mongodb: {
		defaultWriteConcern: 'majority',
		connections: {
			state: {
				host: '127.0.0.1',
				port: 27017,
			},
			telemetry: {
				host: '127.0.0.1',
				port: 27017,
			},
			matchmaking: {
				host: '127.0.0.1',
				port: 27017,
			},
		},
	},
	// these config sections can be referenced inside services to create redis connections
	redis: {
	},
	state: {
		// the module from which the state service loads the collection list
		data: 'sample_game/state/',
		// the maximum number of retries for optimistic concurrency control on state changes
		maxRetries: 5,
		// the duration, in seconds, after which a transaction instance lock is considered to be expired
		lockTimeout: 10,
	},
	matchmaking: {
		// the module from which the matchmaking service loads the available pools
		data: 'sample_game/matchmaking',
		// the duration, in minutes, after which matchmaking sessions expire if not updated
		sessionTTL: 0.5,
	},
}