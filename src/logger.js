"use strict";
const path = require('path');
const fs = require('fs');
const os = require('os');
const winston = require('winston');

const baseDir = process.env.PROGRAMDATA || path.join(os.homedir(), 'AppData', 'Local');
const logDir = path.join(baseDir, 'LoginGuards', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'agent.log'), maxsize: 5 * 1024 * 1024, maxFiles: 3 })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

module.exports = { logger, logDir };
