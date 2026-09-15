import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import GraphCanvas, { type Commit, type RepoView } from "./GraphCanvas";
import Mark from "./Mark";

function folderName(path: string) {
  const p = path.replace(/\/+$/, "");
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

export default function App() {
  const [repo, setRepo] = useState<RepoView | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refreshRecents = useCallback(() => {
    invoke<string[]>("recents_list").then(setRecents).catch(() => setRecents([]));
  }, []);

  const loadPath = useCallback(
    async (path: string) => {
      setError(null);
      try {
        const view = await invoke<RepoView>("open_path", { path });
        setRepo(view);
        setSelected(view.commits[0]?.id ?? null);
        refreshRecents();
      } catch (e) {
        const msg = typeof e === "string" ? e : `Not a Git repository: ${path}`;
        setError(msg);
      }
    },
    [refreshRecents],
  );

  const pick = useCallback(async () => {
    const path = await open({
      directory: true,
      multiple: false,
      title: "Open repository",
    });
    if (typeof path === "string") await loadPath(path);
  }, [loadPath]);

  useEffect(() => {
    refreshRecents();
    const un: Array<() => void> = [];
    listen<RepoView>("repo-loaded", (ev) => {
      setError(null);
      setRepo(ev.payload);
      setSelected(ev.payload.commits[0]?.id ?? null);
      refreshRecents();
    }).then((f) => un.push(f));
    listen<string>("repo-error", (ev) => {
      setError(ev.payload);
    }).then((f) => un.push(f));
    listen("recents-cleared", () => {
      setRecents([]);
    }).then((f) => un.push(f));
    getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "drop" && e.payload.paths[0]) {
          void loadPath(e.payload.paths[0]);
        }
      })
      .then((f) => un.push(f));
    return () => {
      un.forEach((f) => f());
    };
  }, [loadPath, refreshRecents]);

  const commit = repo?.commits.find((c) => c.id === selected) ?? null;

  if (!repo) {
    return (
      <div className="empty" onDragOver={(e) => e.preventDefault()}>
        <Mark size={64} />
        <h1 className="mark">Squad</h1>
        <p className="lede">A local commit graph. Nothing leaves this Mac.</p>
        <button type="button" className="primary" onClick={() => void pick()}>
          Open repository…
        </button>
        <p className="hint">Or drop a project folder here.</p>
        {error ? <p className="error">{error}</p> : null}
        {recents.length > 0 ? (
          <div className="recents">
            <p className="recents-label">Recent</p>
            {recents.map((p) => (
              <button
                key={p}
                type="button"
                className="recent"
                onClick={() => void loadPath(p)}
              >
                <span className="recent-name">{folderName(p)}</span>
                <span className="recent-path">{p}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="bar">
        <Mark size={22} />
        <span className="bar-name">{folderName(repo.path)}</span>
        <span className="bar-count">{repo.commits.length} commits</span>
        <button type="button" className="ghost" onClick={() => void pick()}>
          Open…
        </button>
      </header>
      <div className="body">
        <div className="stage">
          <GraphCanvas
            commits={repo.commits}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <aside className="meta">
          {commit ? <CommitMeta commit={commit} /> : <p className="hint">Select a commit.</p>}
          {error ? <p className="error">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}

function CommitMeta({ commit }: { commit: Commit }) {
  const when = commit.date.replace("T", " ").replace(/\+\d{2}:\d{2}$/, "").slice(0, 19);
  return (
    <div>
      <h2 className="subject">{commit.subject || "(empty)"}</h2>
      <p className="who">
        {commit.author}
        {commit.email ? <span className="email"> {commit.email}</span> : null}
      </p>
      <p className="when">{when}</p>
      <p className="hash">{commit.id}</p>
      <p className="parents">
        {commit.parents.length === 0
          ? "root"
          : commit.parents.map((p) => p.slice(0, 7)).join("  ")}
      </p>
    </div>
  );
}
