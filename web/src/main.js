const {invoke} = window.__TAURI__.core;
const {listen} = window.__TAURI__.event;

const state = document.getElementById('state');
const message = document.getElementById('message');
const quit = document.getElementById('quit');

const update = status => {
  state.textContent = status.state;
  state.className = `state ${status.state}`;
  message.textContent = status.message;
};

invoke('get_status').then(update).catch(error => {
  update({
    state: 'error',
    message: String(error)
  });
});

listen('link-status', event => update(event.payload));

quit.addEventListener('click', () => {
  invoke('quit_app');
});

