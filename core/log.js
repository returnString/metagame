'use strict'

const bunyan = require('bunyan')
const utils = require('./utils')
const config = require('../config')

exports.create = function(name)
{
	const logger = bunyan.createLogger({ name, workerID: utils.getWorkerID() })
	logger.level(config.logging.verbosity)
	return logger
}