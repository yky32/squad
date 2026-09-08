mod git;
mod recents;

use std::path::PathBuf;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn recents_list(app: AppHandle) -> Vec<String> {
    recents::load(&app_data(&app))
}

#[tauri::command]
fn recents_clear(app: AppHandle) -> Result<(), String> {
    recents::clear(&app_data(&app));
    rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
fn open_path(app: AppHandle, path: String) -> Result<git::RepoView, String> {
    open_repo(&app, PathBuf::from(path))
}

fn app_data(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn open_repo(app: &AppHandle, path: PathBuf) -> Result<git::RepoView, String> {
    let view = git::load(&path)?;
    recents::remember(&app_data(app), &view.path);
    rebuild_menu(app);
    Ok(view)
}

fn pick_folder(app: &AppHandle) {
    let handle = app.clone();
    app.dialog().file().pick_folder(move |folder| {
        let Some(folder) = folder else {
            return;
        };
        let path = folder.into_path().unwrap_or_default();
        match open_repo(&handle, path.clone()) {
            Ok(view) => {
                let _ = handle.emit("repo-loaded", view);
            }
            Err(_) => {
                let _ = handle.emit(
                    "repo-error",
                    format!("Not a Git repository: {}", path.display()),
                );
            }
        }
    });
}

fn rebuild_menu(app: &AppHandle) {
    let recents = recents::load(&app_data(app));
    let mut recent_menu = SubmenuBuilder::new(app, "Open Recent");
    if recents.is_empty() {
        let empty = MenuItemBuilder::with_id("recent-empty", "(empty)")
            .enabled(false)
            .build(app)
            .ok();
        if let Some(item) = empty {
            recent_menu = recent_menu.item(&item);
        }
    } else {
        for (i, p) in recents.iter().enumerate() {
            let id = format!("recent-{i}");
            if let Ok(item) = MenuItemBuilder::with_id(&id, p).build(app) {
                recent_menu = recent_menu.item(&item);
            }
        }
    }

    let open = MenuItemBuilder::with_id("open", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app);
    let clear = MenuItemBuilder::with_id("clear-recents", "Clear Recents").build(app);

    let mut file = SubmenuBuilder::new(app, "File");
    if let Ok(open) = open {
        file = file.item(&open);
    }
    if let Ok(recent_menu) = recent_menu.build() {
        file = file.item(&recent_menu);
    }
    if let Ok(clear) = clear {
        file = file.item(&clear);
    }

    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        if let Ok(app_m) = SubmenuBuilder::new(app, "Squad")
            .item(&PredefinedMenuItem::about(app, Some("Squad"), None).unwrap())
            .separator()
            .item(&PredefinedMenuItem::quit(app, None).unwrap())
            .build()
        {
            menu = menu.item(&app_m);
        }
    }
    if let Ok(file) = file.build() {
        menu = menu.item(&file);
    }
    if let Ok(menu) = menu.build() {
        let _ = app.set_menu(menu);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            recents_list,
            recents_clear,
            open_path
        ])
        .setup(|app| {
            rebuild_menu(&app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "open" => pick_folder(app),
                "clear-recents" => {
                    recents::clear(&app_data(app));
                    rebuild_menu(app);
                    let _ = app.emit("recents-cleared", ());
                }
                other if other.starts_with("recent-") => {
                    if other == "recent-empty" {
                        return;
                    }
                    let idx: usize = other.trim_start_matches("recent-").parse().unwrap_or(999);
                    let recents = recents::load(&app_data(app));
                    if let Some(path) = recents.get(idx) {
                        match open_repo(app, PathBuf::from(path)) {
                            Ok(view) => {
                                let _ = app.emit("repo-loaded", view);
                            }
                            Err(_) => {
                                let _ = app.emit(
                                    "repo-error",
                                    format!("Not a Git repository: {path}"),
                                );
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Squad");
}
