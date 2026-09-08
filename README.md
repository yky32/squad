# squad

See a git repo as a **squad** — who writes what, and which files are one-person deep.

Not a branch graph. Not a commit replay. Local `git log` only. No GitHub token.

```
squad  recordo
12 people · 1840 commits · 910 files

Wayne Yu               ██████████████████████  412  +81002 −12011  1d ago
…

bus factor 1  (one person ≥80% of churn, ≥40 lines)
  lib/features/home/park_map.dart                 94%  Wayne Yu
```

## Run

Node 18+. Inside any git repo:

```bash
npx --yes github:yky32/squad
```

or

```bash
git clone https://github.com/yky32/squad
cd your-other-repo
node /path/to/squad/bin/squad.mjs
```

## Why

`git log --graph` shows branches. GitHub shows a green calendar. Neither answers: *if this person leaves, which files die?*

## Not for you

- Pretty branch topology → `git-graph` / `tig`
- Typing replay of diffs → `gitlogue`
- Star charts → GitHub

## License

MIT
