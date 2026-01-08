"use strict";
const { logger } = require('./logger');
const service = require('./service');
const storage = require('./storage');
const { runPS } = require('./ps');
const { setConfig } = require('./config');
const fs = require('fs');
const path = require('path');

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
  setConfig({ failMode: options.failMode, pipeName: options.pipeName, logUsername: !!options.logUsername, timeoutMs: options.timeoutMs });
  logger.info('Installing Windows service...');
  await service.install();
  // DC-only: deploy password filter DLL and register in LSA
  const dc = await isDomainController().catch(() => false);
  if (!dc) {
    logger.info('Non-DC host detected; skipping password filter registration.');
    return;
  }
  logger.info('Domain Controller detected; proceeding with Password Filter registration.');
  const sys32 = process.env.WINDIR ? path.join(process.env.WINDIR, 'System32') : 'C\\\Windows\\System32';
  const targetDll = path.join(sys32, 'LoginGuardsPwdFilter.dll');
  let sourceDll = options.dllPath;
  if (!sourceDll) {
    // Try bundled asset
    const bundled = path.join(__dirname, '..', 'assets', 'LoginGuardsPwdFilter', 'x64', 'LoginGuardsPwdFilter.dll');
    if (fs.existsSync(bundled)) sourceDll = bundled;
  }
  if (!sourceDll || !fs.existsSync(sourceDll)) {
    logger.warn('Password Filter DLL not found. Provide --dllPath to a prebuilt x64 LoginGuardsPwdFilter.dll');
  } else {
    logger.info(`Copying DLL to ${targetDll}`);
    fs.copyFileSync(sourceDll, targetDll);
  }
  const changed = await registerPasswordFilter('LoginGuardsPwdFilter');
  if (changed) {
    logger.info('Password Filter registered in LSA (Notification Packages). Reboot required.');
    if (options.reboot) {
      logger.info('Reboot flag provided; rebooting now.');
      await runPS('Restart-Computer -Force');
    } else {
      console.log('⚠ Reboot required to activate the password filter.');
    }
  } else {
    logger.info('Password Filter already registered.');
  }
}

async function uninstall(options = {}) {
  assertWindows();
  logger.info('Uninstalling Windows service...');
  await service.uninstall();
  await storage.deleteApiKey();
  const dc = await isDomainController().catch(() => false);
  if (!dc) return;
  // DC-only cleanup
  const removed = await unregisterPasswordFilter('LoginGuardsPwdFilter');
  const sys32 = process.env.WINDIR ? path.join(process.env.WINDIR, 'System32') : 'C\\\Windows\\System32';
  const targetDll = path.join(sys32, 'LoginGuardsPwdFilter.dll');
  try { fs.unlinkSync(targetDll); } catch {}
  if (removed) {
    logger.info('Password Filter unregistered. Reboot required to unload.');
    if (options.reboot) {
      logger.info('Reboot flag provided; rebooting now.');
      await runPS('Restart-Computer -Force');
    } else {
      console.log('⚠ Reboot required to fully unload the password filter.');
    }
  }
}

async function isDomainController() {
  const script = `
  $k = Get-Item 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NTDS' -ErrorAction SilentlyContinue
  if ($null -ne $k) { 'DC' } else { 'NOTDC' }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim() === 'DC';
}

async function registerPasswordFilter(nameNoExt) {
  const script = `
  $path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa'
  $name = 'Notification Packages'
  $cur = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
  if ($null -eq $cur) { $cur = @() }
  if ($cur -notcontains '${nameNoExt}') { $new = @($cur) + '${nameNoExt}'; Set-ItemProperty -Path $path -Name $name -Value $new; 'CHANGED' } else { 'NOCHANGE' }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim() === 'CHANGED';
}

async function unregisterPasswordFilter(nameNoExt) {
  const script = `
  $path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa'
  $name = 'Notification Packages'
  $cur = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
  if ($null -eq $cur) { 'NOCHANGE' } else { $new = @($cur) | Where-Object { $_ -ne '${nameNoExt}' }; Set-ItemProperty -Path $path -Name $name -Value $new; 'CHANGED' }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim() === 'CHANGED';
}

module.exports = { install, uninstall };
