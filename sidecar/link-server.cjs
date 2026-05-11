const path = require('path');
const process = require('process');

const resourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!resourceRoot) {
  console.error(JSON.stringify({
    type: 'status',
    state: 'error',
    message: 'Missing resource root argument.'
  }));
  process.exit(1);
}

const linkRoot = path.join(resourceRoot, 'openblock-link');
const OpenBlockLink = require(path.join(linkRoot, 'src', 'index.js'));

let link = null;

const emitStatus = status => {
  process.stdout.write(`${JSON.stringify(Object.assign({type: 'status'}, status))}\n`);
};

const shutdown = () => {
  emitStatus({
    state: 'stopping',
    message: 'Stopping DoGoBlock Link...'
  });
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.stdin.on('data', data => {
  if (data.toString().trim() === 'shutdown') {
    shutdown();
  }
});

emitStatus({
  state: 'starting',
  message: 'Starting DoGoBlock Link...'
});

const userDataPath = process.env.OPENBLOCK_LINK_USER_DATA;
const toolsPath = path.join(linkRoot, 'tools');

link = new OpenBlockLink(userDataPath, toolsPath);
link.on('ready', () => {
  emitStatus({
    state: 'running',
    message: 'DoGoBlock Link is running on 127.0.0.1:20111.'
  });
});
link.on('port-in-use', () => {
  emitStatus({
    state: 'warning',
    message: 'Port 20111 is already in use by another DoGoBlock Link instance.'
  });
});
link.on('error', message => {
  emitStatus({
    state: 'error',
    message
  });
});

link.listen(20111, '127.0.0.1');
