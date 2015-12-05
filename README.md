# metagame
[![Build Status](https://travis-ci.org/returnString/metagame.svg?branch=master)](https://travis-ci.org/returnString/metagame)

Extensible online game backend. Moderately modern with ES6. Highly WIP.

Officially, the following Node versions are tested on Linux:
- 4.2 (LTS)
- 5.0
- 5.1

Unofficially, it's primarily developed on OSX, but CI doesn't cover that.

# Current features
## Protocol
metagame uses websockets with JSON messages for all communication.

It also includes built-in SSL support, although more complex deployments
with specialised app servers will probably want to use SSL termination.

## Authentication
The auth service delegates to a platform-specific authentication method.
The platform takes an auth request and tells metagame the user's:
- user ID: permament identifier, like a numeric Steam ID
- platform-specific data: changeable data, like a display name/gamertag
- privileges

## State
The state service stores collections of objects, where each collection has a list of allowed state changes.
These changes are written as normal Javascript functions that are applied atomically to instances.
They support restrictions on who can apply them, failure cases (eg 'not enough money' for a shop purchase state change)
and can be used to model anything from secure player inventories to world state.

## Wishlist
- Telemetry service: build up full match records, report important events, etc
- Atomic cross-instance state changes (eg trading between players)

# Dependencies
- mongodb
- redis (not yet used in stock services)

# Extension

## Services
This is a simple example of a loading a calculator service that adds two numbers together on request.

To load a new service, just add its file path to your config file, in the services section:
```javascript
module.exports = {
	...
	services: [
		'services/auth',
		'services/state',
		'services/system',
		'/some/long/file/path/calculatorservice',
	],
	...
```

Here's the contents of calculatorservice.js:
```javascript
module.exports = function*(loader)
{
	class CalculatorService extends loader.Service
	{
		// the possible errors this service can return
		// they'll be prefixed with the service name, eg 'calculator/missingSide'
		get serviceErrors() { return [
			'missingSide',
		]}
		
		// do async initialisation here
		// good for creating DB connections, loading files into memory etc
		*init()
		{
		}
		
		*requireLeftAndRight(request)
		{
			if (!request.params.lhs || !request.params.rhs)
			{
				// this error will be shown to the client as:
				// { error: { name: 'calculator/missingSide' } }
				return this.errors.missingSide()
			}
		}
		
		// tell the metagame router what commands to expose
		// each route is an array consisting of the name, function to call and any middleware to call before it
		getRoutes()
		{
			return [
				// this command will be exposed as '/calculator/add'
				// with the two middleware functions, it will reject unauthenticated users and requests that don't contain lhs and rhs params
				[ 'add', this.add, [ this.authenticated, this.requireLeftAndRight ] ],	
			]	
		}
		
		*add(request)
		{
			// this is what the client will see; the whole response will look something like:
			// { data: { result: <x> } }
			return { result: request.params.lhs + request.params.rhs }
		}
	}
	
	return CalculatorService
}
```

## Platforms
// TODO