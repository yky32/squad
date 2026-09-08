use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Clone, Serialize)]
pub struct Commit {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub date: String,
    pub subject: String,
    pub lane: u32,
    pub row: u32,
}

#[derive(Clone, Serialize)]
pub struct RepoView {
    pub path: String,
    pub commits: Vec<Commit>,
}

pub fn is_git_repo(path: &Path) -> bool {
    let dir = path.to_string_lossy();
    Command::new("git")
        .args(["-C", dir.as_ref(), "rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|o| o.status.success() && String::from_utf8_lossy(&o.stdout).trim() == "true")
        .unwrap_or(false)
}

pub fn load(path: &Path) -> Result<RepoView, String> {
    if !path.is_dir() {
        return Err(format!("Not a Git repository: {}", path.display()));
    }
    if !is_git_repo(path) {
        return Err(format!("Not a Git repository: {}", path.display()));
    }

    let dir = path.to_string_lossy();
    let out = Command::new("git")
        .args([
            "-C",
            dir.as_ref(),
            "log",
            "--all",
            "--date-order",
            "--pretty=format:%H%x09%P%x09%an%x09%ae%x09%cI%x09%s",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(format!("Not a Git repository: {}", path.display()));
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut commits = parse_log(&stdout);
    assign_lanes(&mut commits);

    Ok(RepoView {
        path: path.to_string_lossy().into_owned(),
        commits,
    })
}

fn parse_log(stdout: &str) -> Vec<Commit> {
    let mut commits = Vec::new();
    for (row, line) in stdout.lines().enumerate() {
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(6, '\t');
        let id = parts.next().unwrap_or("").to_string();
        let parents = parts
            .next()
            .unwrap_or("")
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        let author = parts.next().unwrap_or("").to_string();
        let email = parts.next().unwrap_or("").to_string();
        let date = parts.next().unwrap_or("").to_string();
        let subject = parts.next().unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }
        commits.push(Commit {
            id,
            parents,
            author,
            email,
            date,
            subject,
            lane: 0,
            row: row as u32,
        });
    }
    commits
}

/// Newest-first (git log order): first parent continues the lane.
fn assign_lanes(commits: &mut [Commit]) {
    let mut lane_tip: Vec<Option<String>> = Vec::new();
    for c in commits.iter_mut() {
        let mut lane = None;
        for (i, tip) in lane_tip.iter().enumerate() {
            if tip.as_deref() == Some(c.id.as_str()) {
                lane = Some(i);
                break;
            }
        }
        let lane = lane.unwrap_or_else(|| {
            if let Some(i) = lane_tip.iter().position(|t| t.is_none()) {
                i
            } else {
                lane_tip.push(None);
                lane_tip.len() - 1
            }
        });
        c.lane = lane as u32;
        if lane_tip.len() <= lane {
            lane_tip.resize(lane + 1, None);
        }
        let first = c.parents.first().cloned();
        lane_tip[lane] = first;
        for extra in c.parents.iter().skip(1) {
            if lane_tip.iter().any(|t| t.as_deref() == Some(extra.as_str())) {
                continue;
            }
            if let Some(i) = lane_tip.iter().position(|t| t.is_none()) {
                lane_tip[i] = Some(extra.clone());
            } else {
                lane_tip.push(Some(extra.clone()));
            }
        }
    }
}
