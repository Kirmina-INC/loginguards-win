"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');

const baseDir = process.env.PROGRAMDATA || path.join(os.homedir(), 'AppData', 'Local');
const confDir = path.join(baseDir, 'LoginGuards');
const confFile = path.join(confDir, 'config.json');

function ensureDir() {
  if (!fs.existsSync(confDir)) fs.mkdirSync(confDir, { recursive: true });
}

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(confFile, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeConfigFile(obj) {
  ensureDir();
  fs.writeFileSync(confFile, JSON.stringify(obj, null, 2), { encoding: 'utf8' });
}

function getConfig() {
  const data = readConfigFile();
  return {
    failMode: data.failMode || 'fail-closed',
    pipeName: data.pipeName || "\\\\.\\pipe\\LoginGuardsPwdFilter",
    logUsername: !!data.logUsername,
    apiKeyEnc: data.apiKeyEnc || undefined
  };
}

function setConfig(partial) {
  const current = readConfigFile();
  const next = { ...current, ...partial };
  writeConfigFile(next);
  return next;
}

module.exports = { getConfig, setConfig, confFile };
