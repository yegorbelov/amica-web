#!/usr/bin/env node
import { cpSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'pnpm-lock.yaml');
const buildPackagePath = path.join(root, 'package.build.json');
const buildLockPath = path.join(root, 'pnpm-lock.build.yaml');

const packageBackup = readFileSync(packagePath, 'utf8');
const lockBackup = readFileSync(lockPath, 'utf8');

try {
  cpSync(buildPackagePath, packagePath);
  execSync('pnpm install --no-frozen-lockfile', { cwd: root, stdio: 'inherit' });
  cpSync(lockPath, buildLockPath);
  console.log('pnpm-lock.build.yaml updated.');
} finally {
  writeFileSync(packagePath, packageBackup);
  writeFileSync(lockPath, lockBackup);
  execSync('pnpm install', { cwd: root, stdio: 'inherit' });
}
