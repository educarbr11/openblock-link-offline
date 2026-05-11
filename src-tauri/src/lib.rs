use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Clone, Debug, Deserialize, Serialize)]
struct LinkStatus {
    state: String,
    message: String,
}

impl Default for LinkStatus {
    fn default() -> Self {
        Self {
            state: "starting".into(),
            message: "Starting DoGoBlock Link...".into(),
        }
    }
}

#[derive(Default)]
struct LinkState {
    status: Mutex<LinkStatus>,
    child: Mutex<Option<CommandChild>>,
}

#[tauri::command]
fn get_status(state: tauri::State<LinkState>) -> LinkStatus {
    state.status.lock().expect("status lock poisoned").clone()
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn set_status(app: &AppHandle, status: LinkStatus) {
    let state = app.state::<LinkState>();
    *state.status.lock().expect("status lock poisoned") = status.clone();
    let _ = app.emit("link-status", status);
}

fn start_link(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();
    let resource_root = resource_root(app)?;
    let user_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&user_data)?;

    let script_path = resource_root.join("sidecar").join("link-server.cjs");
    let command = app
        .shell()
        .sidecar("node")?
        .args([
            script_path.to_string_lossy().to_string(),
            resource_root.to_string_lossy().to_string(),
        ])
        .env(
            "OPENBLOCK_LINK_USER_DATA",
            user_data.to_string_lossy().to_string(),
        );

    let (mut rx, child) = command.spawn()?;
    {
        let state = app.state::<LinkState>();
        *state.child.lock().expect("child lock poisoned") = Some(child);
    }

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let output = String::from_utf8_lossy(&line);
                    for raw_line in output.lines() {
                        if let Ok(status) = serde_json::from_str::<LinkStatusEvent>(raw_line) {
                            set_status(&app_handle, status.into());
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let message = String::from_utf8_lossy(&line).trim().to_string();
                    if !message.is_empty() {
                        set_status(
                            &app_handle,
                            LinkStatus {
                                state: "error".into(),
                                message,
                            },
                        );
                    }
                }
                CommandEvent::Terminated(payload) => {
                    set_status(
                        &app_handle,
                        LinkStatus {
                            state: "stopped".into(),
                            message: format!("DoGoBlock Link stopped: {:?}", payload),
                        },
                    );
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn resource_root(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if cfg!(dev) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        return manifest_dir
            .parent()
            .map(PathBuf::from)
            .ok_or_else(|| "Unable to resolve project root.".into());
    }

    Ok(app.path().resource_dir()?)
}

#[derive(Deserialize)]
struct LinkStatusEvent {
    #[serde(rename = "type")]
    event_type: String,
    state: String,
    message: String,
}

impl From<LinkStatusEvent> for LinkStatus {
    fn from(event: LinkStatusEvent) -> Self {
        let _ = event.event_type;
        Self {
            state: event.state,
            message: event.message,
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(LinkState::default())
        .invoke_handler(tauri::generate_handler![get_status, quit_app])
        .setup(|app| {
            if let Err(error) = start_link(app) {
                set_status(
                    app.handle(),
                    LinkStatus {
                        state: "error".into(),
                        message: error.to_string(),
                    },
                );
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<LinkState>();
                let child = state.child.lock().expect("child lock poisoned").take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
