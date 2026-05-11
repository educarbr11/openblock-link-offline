const patchStream = stream => {
  if (!stream) {
    return;
  }
  if (typeof stream.clearLine !== 'function') {
    stream.clearLine = () => {};
  }
  if (typeof stream.cursorTo !== 'function') {
    stream.cursorTo = () => {};
  }
};

patchStream(process.stderr);
patchStream(process.stdout);

