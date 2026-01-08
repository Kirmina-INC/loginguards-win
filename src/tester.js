"use strict";
const { logger } = require('./logger');
const service = require('./service');
const storage = require('./storage');
const apiClient = require('./apiClient');
const { getConfig } = require('./config');
const net = require('net');
const { runPS } = require('./ps');

async function run({ user, mode = 'auto', verbose = false }) {
  console.log('Running LoginGuards test suite...\n');

  const isDc = await isDomainController().catch(() => false);
  const execMode = mode === 'auto' ? (isDc ? 'dc' : 'client') : mode;

  // Service status (common)
  const running = await service.isRunning().catch(() => false);
  console.log(running ? '✔ Password policy engine service running' : '✖ Password policy engine service not running');

  // API connectivity (common)
  const apiKey = await storage.getApiKey();
  if (!apiKey) {
    console.log('✖ API key not configured. Run "loginguards-win configure".');
    return;
  }
  try { await apiClient.ping(apiKey); console.log('✔ LoginGuards API reachable'); } catch { console.log('✖ LoginGuards API not reachable'); }

  if (execMode === 'dc') {
    console.log('✔ Domain Controller detected');
    // Registry check
    const filterReg = await isFilterRegistered('LoginGuardsPwdFilter');
    console.log(filterReg ? '✔ Password filter registered' : '✖ Password filter not registered');
    // DLL presence
    const dllExists = await dllPresent();
    console.log(dllExists ? '✔ Password filter DLL present in System32' : '✖ Password filter DLL missing in System32');
    // Pipe check
    const pipeOk = await pipeHealth();
    console.log(pipeOk ? '✔ Named pipe OK' : '✖ Named pipe unavailable');

    // End-to-end evaluation via API (non-destructive)
    const testPwd = `Lg!Test-${Math.random().toString(36).slice(2, 8)}A1`;
    try {
      const res = await apiClient.checkPlain(testPwd, apiKey);
      const compromised = (typeof res.breached !== 'undefined') ? !!res.breached
        : (typeof res.compromised !== 'undefined') ? !!res.compromised
        : false;
      console.log(`✔ Test password evaluated: ${compromised ? 'COMPROMISED' : 'NOT COMPROMISED'}`);
      console.log(`✔ Test complete successfully for user "${user || 'DOMAIN\\test-user'}"`);
    } catch (e) {
      logger.warn(`Test evaluation error: ${e.message || e}`);
      console.log('✖ Test evaluation failed');
    }
    return;
  }

  // client mode
  const info = await getDomainInfo().catch(() => null);
  if (info && info.PartOfDomain) {
    console.log(`✔ Client is joined to domain: ${info.Domain || 'UNKNOWN'}`);
    if (info.LogonServer) console.log(`✔ Logon server: ${info.LogonServer}`);
  } else {
    console.log('✖ Client is not domain-joined or unable to detect domain');
  }
  console.log('ℹ Enforcement validation must be run on a Domain Controller.');
}

async function isDomainController() {
  const script = `
  $k = Get-Item 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NTDS' -ErrorAction SilentlyContinue
  if ($null -ne $k) { 'DC' } else { 'NOTDC' }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim() === 'DC';
}

async function isFilterRegistered(nameNoExt) {
  const script = `
  $path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa'
  $name = 'Notification Packages'
  $cur = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
  if ($null -eq $cur) { 'NO' } elseif ($cur -contains '${nameNoExt}') { 'YES' } else { 'NO' }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim() === 'YES';
}

async function dllPresent() {
  const sys32 = process.env.WINDIR ? require('path').join(process.env.WINDIR, 'System32') : 'C\\\\Windows\\\\System32';
  const dll = require('path').join(sys32, 'LoginGuardsPwdFilter.dll');
  try { require('fs').accessSync(dll); return true; } catch { return false; }
}

async function pipeHealth() {
  const { pipeName } = getConfig();
  return new Promise((resolve) => {
    const socket = net.createConnection(pipeName, () => {
      // send minimal JSON and close
      socket.write(JSON.stringify({ password: `Lg!Probe-${Date.now()}aA1`, op: 'change' }) + '\n');
    });
    let responded = false;
    socket.on('data', () => { responded = true; socket.end(); });
    socket.on('error', () => resolve(false));
    socket.on('end', () => resolve(responded));
    setTimeout(() => { try { socket.destroy(); } catch {} resolve(false); }, 1000);
  });
}

async function getDomainInfo() {
  const script = `
  $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
  if ($null -eq $cs) { Write-Output '{}' } else {
    $obj = [ordered]@{
      PartOfDomain = $cs.PartOfDomain
      Domain = $cs.Domain
      LogonServer = $env:LOGONSERVER
    }
    $obj | ConvertTo-Json -Compress
  }
  `;
  const { stdout } = await runPS(script);
  try { return JSON.parse(stdout.trim()); } catch { return null; }
}

module.exports = { run };
