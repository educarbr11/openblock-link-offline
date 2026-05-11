# OpenBlock Link Offline

Tauri wrapper for packaging `openblock-link` as an offline desktop app for Linux and Windows.

The upstream OpenBlock Link project lives in `openblock-link/` as a Git submodule. Do not edit files inside that submodule for wrapper changes.

## Local Linux build

Install Tauri Linux prerequisites on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y build-essential curl wget file libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libssl-dev
```

Use Rust 1.88 or newer. This repository includes `rust-toolchain.toml`, so `rustup` will install the pinned toolchain automatically when needed.

Then build:

```bash
git submodule update --init --recursive
npm install
npm run build:linux
```

The AppImage is generated under:

```text
src-tauri/target/release/bundle/appimage/
```

When the app is running, the local OpenBlock Link server should answer:

```bash
curl http://127.0.0.1:20111/
```

Expected output:

```text
openblock-link-server
```
