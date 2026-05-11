import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const openblockDir = path.join(root, 'openblock-link');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: Object.assign({}, process.env, options.env ?? {}),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!existsSync(path.join(openblockDir, 'package.json'))) {
  run('git', ['submodule', 'update', '--init', '--recursive']);
}

run('npm', ['ci'], {cwd: openblockDir});
run('npm', ['run', 'fetch'], {
  cwd: openblockDir,
  env: {
    NODE_OPTIONS: `--require ${path.join(root, 'scripts', 'ci-progress-stream-patch.cjs')}`
  }
});
