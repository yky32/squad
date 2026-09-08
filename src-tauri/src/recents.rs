use std::fs;
use std::path::{Path, PathBuf};

const MAX: usize = 10;
const FILE: &str = "recents.json";

fn file(app_data: &Path) -> PathBuf {
    app_data.join(FILE)
}

pub fn load(app_data: &Path) -> Vec<String> {
    let p = file(app_data);
    let Ok(raw) = fs::read_to_string(p) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save(app_data: &Path, recents: &[String]) {
    let _ = fs::create_dir_all(app_data);
    let _ = fs::write(file(app_data), serde_json::to_vec(recents).unwrap_or_default());
}

pub fn remember(app_data: &Path, path: &str) -> Vec<String> {
    let mut recents: Vec<String> = load(app_data)
        .into_iter()
        .filter(|p| p != path)
        .collect();
    recents.insert(0, path.to_string());
    recents.truncate(MAX);
    save(app_data, &recents);
    recents
}

pub fn clear(app_data: &Path) {
    save(app_data, &[]);
}
