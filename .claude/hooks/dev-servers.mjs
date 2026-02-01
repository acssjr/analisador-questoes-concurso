#!/usr/bin/env node
/**
 * Auto-start dev servers on SessionStart
 * Only starts if ports are not already in use
 */

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use __dirname to reliably get project dir (two levels up from .claude/hooks/)
const projectDir = join(__dirname, '..', '..');

// Read stdin (hook protocol)
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    await main();
  } catch (err) {
    console.log(JSON.stringify({ result: 'continue', message: `Dev server hook error: ${err.message}` }));
  }
});

function portInUse(port) {
  try {
    const result = execSync(`netstat -ano 2>nul | findstr ":${port} "`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

async function main() {
  const BACKEND_PORT = 8000;
  const FRONTEND_PORTS = [5173, 5174, 5175, 5176];

  // Ensure cache directory exists
  const cacheDir = join(projectDir, '.claude', 'cache');
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  let backendStarted = false;
  let frontendStarted = false;

  // Start backend if port 8000 is free
  if (!portInUse(BACKEND_PORT)) {
    const logFile = join(cacheDir, 'backend.log');
    const logFd = openSync(logFile, 'w');

    const child = spawn('uv', ['run', 'uvicorn', 'src.api.main:app', '--reload', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)], {
      cwd: projectDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      shell: true,
      windowsHide: true
    });
    child.unref();
    closeSync(logFd);
    backendStarted = true;
  }

  // Check if any frontend port is in use
  let frontendRunning = FRONTEND_PORTS.some(port => portInUse(port));

  // Start frontend if no vite port is in use
  if (!frontendRunning) {
    const frontendDir = join(projectDir, 'frontend');
    if (existsSync(frontendDir)) {
      const logFile = join(cacheDir, 'frontend.log');
      const logFd = openSync(logFile, 'w');

      const child = spawn('npm', ['run', 'dev'], {
        cwd: frontendDir,
        detached: true,
        stdio: ['ignore', logFd, logFd],
        shell: true,
        windowsHide: true
      });
      child.unref();
      closeSync(logFd);
      frontendStarted = true;
    }
  }

  // Build status message
  let msg = '';
  if (backendStarted && frontendStarted) {
    msg = 'Dev servers starting (backend:8000, frontend:5173+)';
  } else if (backendStarted) {
    msg = 'Backend starting on :8000 (frontend already running)';
  } else if (frontendStarted) {
    msg = 'Frontend starting (backend already running on :8000)';
  }

  // Output hook response
  if (msg) {
    console.log(JSON.stringify({ result: 'continue', message: msg }));
  } else {
    console.log(JSON.stringify({ result: 'continue' }));
  }
}
