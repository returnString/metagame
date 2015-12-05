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