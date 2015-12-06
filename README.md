# metagame

Extensible online game backend. Moderately modern with ES6. Highly WIP.

## Linux
[![Build Status](https://travis-ci.org/returnString/metagame.svg?branch=master)](https://travis-ci.org/returnString/metagame)

## Windows
[![Build status](https://ci.appveyor.com/api/projects/status/9cknkest4bohfawd?svg=true)](https://ci.appveyor.com/project/returnString/metagame)

# Short version
metagame will take care of your...
- user profiles and inventories
- in-game shop
- custom platform integration
- annoying in-house PHP 'backend' from three projects ago

It uses websockets and JSON, and so should be easily usable from most languages.
It also includes SSL support if you don't feel like setting up SSL termination.

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
Officially, the following Node versions are tested on Linux and Windows:
- 4.2 (LTS)
- 5.0
- 5.1

Unofficially, it's primarily developed on OSX, but CI doesn't cover that.

To install and run:
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
