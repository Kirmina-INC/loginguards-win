"use strict";
const { logger } = require('./logger');
const service = require('./service');
const storage = require('./storage');
const { runPS } = require('./ps');
const { setConfig } = require('./config');

function assertWindows() {
  if (process.platform !== 'win32') throw new Error('Windows only');
}

async function checkAdmin() {
  const script = `
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal $id
  if ($p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) { Write-Output 'Admin' } else { Write-Output 'NonAdmin' }
  `;
  const { stdout } = await runPS(script);
  const isAdmin = stdout.trim() === 'Admin';
  if (!isAdmin) throw new Error('Administrator privileges required. Please run in an elevated PowerShell.');
  return true;
}

async function install(options) {
  assertWindows();
  await checkAdmin();
  // Persist configuration for the service
  setConfig({ failMode: options.failMode, pipeName: options.pipeName, logUsername: !!options.logUsername });
  logger.info('Installing Windows service...');
  await service.install();
  logger.info('Note: AD Password Filter registration not yet implemented in this preview.');
}

async function uninstall() {
  assertWindows();
  logger.info('Uninstalling Windows service...');
  await service.uninstall();
  await storage.deleteApiKey();
}

module.exports = { install, uninstall };
