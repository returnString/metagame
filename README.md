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

## Planned features
See the [issue tracker](https://github.com/returnString/metagame/labels/feature).

# Dependencies
- mongodb
- redis (not yet used in stock services)

# Extension

## Services
This is a simple example of a loading a calculator service that adds two numbers together on request.

To load a new service, just add its file path to your config file, in the services section.
Paths can be absolute, or relative to metagame's working dir.
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
			// services have some DB helpers included
			// they load connection params from the specified name in the 'redis' and 'mongo' config sections
			this.mongo = yield this.createMongoConnection('calculator')
			this.redis = yield this.createRedisConnection('calculator')
		}
		
		// this is a middleware function; it gets executed *before* the route itself
		// if a middleware function returns something, then we stop and send that data to the client
		// if a middleware function returns nothing, the request carries on as normal
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
		// middleware are called in the order they're defined here
		getRoutes()
		{
			return [
				// this command will be exposed as '/calculator/add'
				// it will reject unauthenticated users and requests that don't contain lhs and rhs params
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
Currently, platforms only serve to authenticate users.
In the future, they'll include support for things like external entitlements, consumables etc.

You can change the active platform for a metagame instance by modifying the `platform` config property:

```javascript
module.exports = {
	...
	platform: '/path/to/myplatform',
	...
```

Here's the contents of myplatform.js, a custom platform class that queries a web service for user info based on a client token.
```javascript
module.exports = function*(loader)
{
	class MyPlatform extends loader.Platforms
	{
		*authenticate(req)
		{
			const userToken = req.params.token
			const myUserData = yield doAnHttpRequest('https://myplatform.com/userinfo?token=' + userToken)
			return {
				id: myUserData.somePermanentID,
				platformData: { displayName: myUserData.someTransientName },
				privileges: [],
			}
		}
	}
	
	return MyPlatform
}
```