# Squad

Local desktop Git visualizer. Open a working directory on disk. Reads `.git`. Draws the commit graph. Offline. Nothing is uploaded.

**Window title:** Squad  
**Identifier:** `com.squad.gitviz`  
**License:** MIT OR Apache-2.0

## Run

Rust 1.85+ (this repo builds on 1.98). Node 18+.

```bash
cd squad
npm install
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri dev
```

Empty screen: **Open repository…** or drop a project folder. File menu: Open…, Open Recent, Clear Recents.

## Not in v0

Checkout, merge, GitHub, clone-from-URL, blame, diff editor, telemetry.

## Stack

Tauri 2 · Rust · React · TypeScript · Vite · Canvas 2D graph · `git` CLI only.
