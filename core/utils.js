const cluster = require('cluster')

exports.getWorkerID = function()
{
	return cluster.isMaster ? 'master' : cluster.worker.id
}