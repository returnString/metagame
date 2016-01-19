'use strict'

const cluster = require('cluster')

exports.getWorkerID = function()
{
	return cluster.isMaster ? 'master' : cluster.worker.id
}

exports.detectName = function(object, basedOn)
{
	const search = basedOn.toLowerCase()
	const lowerCaseCtor = object.constructor.name.toLowerCase()
	
	if (lowerCaseCtor.endsWith(search))
	{
		return lowerCaseCtor.substring(0, lowerCaseCtor.length - search.length)
	}
	else
	{
		return lowerCaseCtor
	}
}

exports.bindAndCopy = function(func, target)
{
	const bound = func.bind(target)
	for (const prop in func)
	{
		if (func.hasOwnProperty(prop))
		{
			bound[prop] = func[prop]
		}
	}
	return bound
}