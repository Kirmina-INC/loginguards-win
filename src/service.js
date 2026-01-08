"use strict";
const path = require('path');
const { Service } = require('node-windows');
const { runPS } = require('./ps');

const serviceName = 'LoginGuardsPolicyEngine';
const scriptPath = path.join(__dirname, 'service', 'engine.js');

function makeService() {
  return new Service({
    name: serviceName,
    description: 'LoginGuards password policy decision engine',
    script: scriptPath,
    wait: 2,
    grow: 0.5
  });
}

async function install() {
  return new Promise((resolve, reject) => {
    const svc = makeService();
    svc.on('install', () => svc.start());
    svc.on('alreadyinstalled', () => resolve());
    svc.on('start', () => resolve());
    svc.on('error', reject);
    svc.install();
  });
}

async function uninstall() {
  return new Promise((resolve, reject) => {
    const svc = makeService();
    svc.on('uninstall', resolve);
    svc.on('error', reject);
    svc.uninstall();
  });
}

async function isRunning() {
  const script = `
  try {
    $s = Get-Service -Name '${serviceName}' -ErrorAction Stop
    if ($s.Status -eq 'Running') { Write-Output 'Running' } else { Write-Output 'NotRunning' }
  } catch { Write-Output 'NotInstalled' }
  `;
  const { stdout } = await runPS(script);
  const out = stdout.trim();
  return out === 'Running';
}

module.exports = { install, uninstall, isRunning, serviceName, scriptPath };
