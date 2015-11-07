'use strict'

const WebSocket = require('ws')
const util = require('util')
const config = require('../config')
const readline = require('readline')
const rl = readline.createInterface(process.stdin, process.stdout)
const url = util.format('ws://localhost:%d', config.websocket.port)

const commands = {
	auth: {
		path: '/auth',
		params: [ 'userID' ],
	},
	time: {
		path: '/system/time',
		params: [],
	},
}

let state = ''
function switchState(name, extra)
{
	state = name
	if (extra)
	{
		rl.setPrompt(name + ' (' + extra + ')> ')
	}
	else
	{
		rl.setPrompt(name + '> ')
	}
	rl.prompt()
}

const ws = new WebSocket(url)

let command
let commandName
let params
let paramIndex
let paramCount

function send()
{
	const message = {
		path: command.path,
		params,
	}
	
	ws.send(JSON.stringify(message))
}

ws.on('open', () =>
{
	switchState('command')
	rl.on('line', line =>
	{
		switch (state)
		{
			case 'command':
			{
				commandName = line
				command = commands[commandName]
				if (command)
				{
					params = {}
					paramIndex = 0
					paramCount = command.params.length
					if (paramCount)
					{
						switchState('params', command.params[0])
					}
					else
					{
						send()
					}
				}
				else
				{
					switchState('command')
				}
			}
			break
			
			case 'params':
			{
				var param = command.params[paramIndex]
				params[param] = line
				
				paramIndex++
				if (paramIndex === paramCount)
				{
					send()
				}
				else
				{
					switchState('params', command.params[paramIndex])
				}
			}
			break
		}
	})
})

ws.on('message', message =>
{
	console.log('got server response', message)
	switchState('command')
})