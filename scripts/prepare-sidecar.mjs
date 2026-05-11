import {createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import path from 'node:path';
import process from 'node:process';

const NODE_VERSION = process.env.NODE_RUNTIME_VERSION ?? '22.15.1';
const root = process.cwd();
const binaryDir = path.join(root, 'src-tauri', 'binaries');
const cacheDir = path.join(root, '.cache', 'node-runtime');

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }

  return result.stdout.trim();
};

const hostTriple = () => {
  try {
    return run('rustc', ['--print', 'host-tuple']);
  } catch {
    const verbose = run('rustc', ['-Vv']);
    const host = verbose.split(/\r?\n/).find(line => line.startsWith('host:'));
    if (!host) {
      throw new Error('Unable to determine Rust host target triple.');
    }
    return host.split(':')[1].trim();
  }
};

const platformArchive = () => {
  if (process.platform === 'linux' && process.arch === 'x64') {
    return {
      archive: `node-v${NODE_VERSION}-linux-x64.tar.xz`,
      nodePath: path.join(`node-v${NODE_VERSION}-linux-x64`, 'bin', 'node')
    };
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return {
      archive: `node-v${NODE_VERSION}-win-x64.zip`,
      nodePath: path.join(`node-v${NODE_VERSION}-win-x64`, 'node.exe')
    };
  }

  throw new Error(`Unsupported sidecar platform: ${process.platform}/${process.arch}`);
};

const download = async (url, outputPath) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
};

const extract = archivePath => {
  if (archivePath.endsWith('.zip')) {
    run('tar', ['-xf', archivePath, '-C', cacheDir]);
    return;
  }

  run('tar', ['-xJf', archivePath, '-C', cacheDir]);
};

mkdirSync(binaryDir, {recursive: true});
mkdirSync(cacheDir, {recursive: true});

const triple = hostTriple();
const extension = process.platform === 'win32' ? '.exe' : '';
const sidecarPath = path.join(binaryDir, `node-${triple}${extension}`);

if (existsSync(sidecarPath)) {
  console.log(`Sidecar already exists: ${sidecarPath}`);
  process.exit(0);
}

const {archive, nodePath} = platformArchive();
const archivePath = path.join(cacheDir, archive);
const extractedNodePath = path.join(cacheDir, nodePath);

if (!existsSync(extractedNodePath)) {
  rmSync(cacheDir, {recursive: true, force: true});
  mkdirSync(cacheDir, {recursive: true});

  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archive}`;
  console.log(`Downloading ${url}`);
  await download(url, archivePath);
  extract(archivePath);
}

copyFileSync(extractedNodePath, sidecarPath);
if (process.platform !== 'win32') {
  chmodSync(sidecarPath, 0o755);
}

console.log(`Prepared Node sidecar: ${sidecarPath}`);
