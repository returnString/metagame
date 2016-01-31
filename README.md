# metagame

Extensible online game backend. Moderately modern with ES6. Highly WIP.

# Short version
metagame will take care of your...
- user profiles and inventories
- in-game shop
- matchmaking
- custom platform integration
- annoying in-house PHP 'backend' from three projects ago

It uses websockets and JSON, and so should be easily usable from most languages.
It also includes SSL support if you don't feel like setting up SSL termination.

# Clients
- [Unity](https://github.com/returnString/metagame.unity)

# Documentation
## Protocol
-	[Requests and responses](https://github.com/returnString/metagame/wiki/Protocol)

## Stock services
- [Using the authentication service](https://github.com/returnString/metagame/wiki/Authentication-service)
- [Using the state service](https://github.com/returnString/metagame/wiki/State-service)

## Extension
- [Creating a custom service](https://github.com/returnString/metagame/wiki/Custom-services)
- [Creating a custom platform](https://github.com/returnString/metagame/wiki/Custom-platforms)

# Planned features
See the [issue tracker](https://github.com/returnString/metagame/labels/feature).

# Installation

## Linux build status
[![Build Status](https://travis-ci.org/returnString/metagame.svg?branch=master)](https://travis-ci.org/returnString/metagame)

## Windows build status
[![Build status](https://ci.appveyor.com/api/projects/status/9cknkest4bohfawd/branch/master?svg=true)](https://ci.appveyor.com/project/returnString/metagame/branch/master)


Officially, the following Node versions are tested on Linux and Windows:
- 5.x (0-4)

Unofficially, it's primarily developed on OSX, but CI doesn't cover that.

## Install from npm

```
npm install metagame --save
```
```javascript
const MetagameServer = require('metagame')
const config = require('config')
const co = require('co')

const server = new MetagameServer(config)
co(function*()
{
	yield server.init()
}).catch(err => console.error(err.stack))
```

## Install from source 
```
git clone https://github.com/returnString/metagame
cd metagame
npm install
npm test
node metagame /path/to/my/config
```

## Dependencies
- mongodb
- redis (not yet used in stock services)
