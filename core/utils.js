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
	
	if (object.name)
	{
		return object.name
	}
	else if (lowerCaseCtor.endsWith(search))
	{
		return lowerCaseCtor.substring(0, lowerCaseCtor.length - search.length)
	}
	else
	{
		return lowerCaseCtor
	}
}