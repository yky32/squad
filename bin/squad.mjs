#!/usr/bin/env node
/**
 * squad — local git → people view. No GitHub API.
 */
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const BAR = 22;

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function inRepo(cwd) {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

function repoName(cwd) {
  try {
    const top = git(['rev-parse', '--show-toplevel'], cwd).trim();
    return basename(top);
  } catch {
    return 'repo';
  }
}

function parseLog(raw) {
  const authors = new Map();
  const files = new Map();
  let cur = null;
  let commits = 0;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT\t')) {
      const [, hash, name, email, at] = line.split('\t');
      const key = (email || name || 'unknown').toLowerCase();
      if (!authors.has(key)) {
        authors.set(key, {
          name: name || email || 'unknown',
          email: email || '',
          commits: 0,
          added: 0,
          deleted: 0,
          last: 0,
        });
      }
      cur = authors.get(key);
      cur.commits += 1;
      const ts = Number(at) || 0;
      if (ts > cur.last) cur.last = ts;
      commits += 1;
      void hash;
      continue;
    }
    if (!cur || !line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [a, d, path] = parts;
    if (a === '-' || d === '-') continue;
    const add = Number(a) || 0;
    const del = Number(d) || 0;
    cur.added += add;
    cur.deleted += del;
    if (!path) continue;
    if (!files.has(path)) files.set(path, new Map());
    const by = files.get(path);
    const prev = by.get(cur.email || cur.name) || { name: cur.name, lines: 0 };
    prev.lines += add + del;
    by.set(cur.email || cur.name, prev);
  }

  return { authors, files, commits };
}

function bar(frac) {
  const n = Math.round(Math.max(0, Math.min(1, frac)) * BAR);
  return '█'.repeat(n).padEnd(BAR, '░');
}

function pad(s, w) {
  const t = String(s);
  return t.length >= w ? t.slice(0, w) : t + ' '.repeat(w - t.length);
}

function fmtWhen(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function busFactor1(files) {
  const out = [];
  for (const [path, by] of files) {
    let total = 0;
    let top = { name: '', lines: 0 };
    for (const v of by.values()) {
      total += v.lines;
      if (v.lines > top.lines) top = v;
    }
    if (total < 40) continue;
    if (top.lines / total >= 0.8) {
      out.push({ path, owner: top.name, share: top.lines / total, total });
    }
  }
  out.sort((a, b) => b.total - a.total);
  return out.slice(0, 12);
}

function main() {
  const cwd = process.cwd();
  if (!inRepo(cwd)) {
    console.error('squad: not a git repo. cd into one and run again.');
    process.exit(1);
  }

  let raw;
  try {
    raw = git(
      [
        'log',
        '--all',
        '--no-merges',
        '--numstat',
        '--pretty=format:COMMIT\t%H\t%an\t%ae\t%at',
      ],
      cwd,
    );
  } catch (e) {
    console.error('squad: git log failed.');
    console.error(String(e.stderr || e.message || e));
    process.exit(1);
  }

  const { authors, files, commits } = parseLog(raw);
  const list = [...authors.values()].sort(
    (a, b) => b.commits - a.commits || b.added - a.added,
  );
  const maxC = list[0]?.commits || 1;
  const name = repoName(cwd);

  console.log(`squad  ${name}`);
  console.log(`${list.length} people · ${commits} commits · ${files.size} files`);
  console.log('');

  for (const a of list.slice(0, 16)) {
    console.log(
      `${pad(a.name, 22)} ${bar(a.commits / maxC)}  ${String(a.commits).padStart(4)}  +${a.added} −${a.deleted}  ${fmtWhen(a.last)}`,
    );
  }

  const risk = busFactor1(files);
  console.log('');
  console.log('bus factor 1  (one person ≥80% of churn, ≥40 lines)');
  if (risk.length === 0) {
    console.log('  none in this window');
    return;
  }
  for (const r of risk) {
    const pct = Math.round(r.share * 100);
    console.log(`  ${pad(r.path, 48)}  ${pct}%  ${r.owner}`);
  }
}

main();
