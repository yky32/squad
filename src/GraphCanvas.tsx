import { useCallback, useEffect, useMemo, useRef } from "react";

export type Commit = {
  id: string;
  parents: string[];
  author: string;
  email: string;
  date: string;
  subject: string;
  lane: number;
  row: number;
};

export type RepoView = {
  path: string;
  commits: Commit[];
};

const ROW = 36;
const COL = 18;
const PAD_X = 22;
const PAD_Y = 18;
const R = 5;

const PALETTE = ["#1c1916", "#c45c26", "#2f5d50", "#3d4a7a", "#8a3d4a", "#6b5a2e"];

function authorColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Props = {
  commits: Commit[];
  selected: string | null;
  onSelect: (id: string) => void;
};

export default function GraphCanvas({ commits, selected, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, scale: 1 });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const commitsRef = useRef(commits);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  commitsRef.current = commits;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  const byId = useMemo(() => {
    const m = new Map<string, Commit>();
    for (const c of commits) m.set(c.id, c);
    return m;
  }, [commits]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  const maxLane = useMemo(
    () => commits.reduce((m, c) => Math.max(m, c.lane), 0),
    [commits],
  );
  const maxLaneRef = useRef(maxLane);
  maxLaneRef.current = maxLane;

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#faf8f4";
    ctx.fillRect(0, 0, w, h);

    const { x: cx, y: cy, scale } = cam.current;
    const list = commitsRef.current;
    if (list.length === 0) return;

    const rowH = ROW * scale;
    const first = Math.max(0, Math.floor((-cy - PAD_Y * scale) / rowH) - 1);
    const last = Math.min(
      list.length - 1,
      Math.ceil((-cy + h + PAD_Y * scale) / rowH) + 1,
    );
    const map = byIdRef.current;
    const sel = selectedRef.current;
    const textX =
      PAD_X + (maxLaneRef.current + 1) * COL * scale + 16 * scale + cx;

    ctx.lineWidth = Math.max(1, 1.15 * scale);
    ctx.strokeStyle = "#d9d2c6";
    for (let i = first; i <= last; i++) {
      const c = list[i];
      if (!c) continue;
      const x = PAD_X + c.lane * COL * scale + cx;
      const y = PAD_Y + c.row * ROW * scale + cy;
      for (const pid of c.parents) {
        const p = map.get(pid);
        if (!p) continue;
        const px = PAD_X + p.lane * COL * scale + cx;
        const py = PAD_Y + p.row * ROW * scale + cy;
        if ((py < -48 && y < -48) || (py > h + 48 && y > h + 48)) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x, (y + py) / 2, px, (y + py) / 2, px, py);
        ctx.stroke();
      }
    }

    const fontMain = `${Math.max(11, 12.5 * scale)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const fontMeta = `${Math.max(10, 11 * scale)}px ui-monospace, Menlo, monospace`;

    for (let i = first; i <= last; i++) {
      const c = list[i];
      if (!c) continue;
      const x = PAD_X + c.lane * COL * scale + cx;
      const y = PAD_Y + c.row * ROW * scale + cy;
      const on = c.id === sel;
      if (on) {
        ctx.fillStyle = "#f3e6d4";
        ctx.fillRect(0, y - 16 * scale, w, 32 * scale);
      }
      ctx.beginPath();
      ctx.arc(x, y, R * scale, 0, Math.PI * 2);
      ctx.fillStyle = on ? "#c45c26" : authorColor(c.author);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = "#1c1916";
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        ctx.stroke();
      }

      ctx.textBaseline = "middle";
      ctx.font = fontMain;
      ctx.fillStyle = "#1c1916";
      const subj = c.subject.length > 72 ? `${c.subject.slice(0, 71)}…` : c.subject;
      ctx.fillText(subj || "(empty)", textX, y - 1);
      ctx.font = fontMeta;
      ctx.fillStyle = "#7a746c";
      const meta = `${c.id.slice(0, 7)}  ${c.author}`;
      ctx.fillText(meta, textX, y + 12 * scale);
    }
  }, []);

  useEffect(() => {
    const el = wrap.current;
    const canvas = ref.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      size.current = { w: r.width, h: r.height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [commits, selected, draw]);

  function worldRow(clientY: number) {
    const rect = ref.current!.getBoundingClientRect();
    const y = clientY - rect.top - cam.current.y - PAD_Y * cam.current.scale;
    return y / (ROW * cam.current.scale);
  }

  function hit(clientY: number): string | null {
    const list = commitsRef.current;
    const row = worldRow(clientY);
    const i = Math.round(row);
    if (i < 0 || i >= list.length) return null;
    return list[i]?.id ?? null;
  }

  return (
    <div ref={wrap} className="graph-wrap">
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          origin.current = { x: e.clientX, y: e.clientY };
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          cam.current.x += e.clientX - drag.current.x;
          cam.current.y += e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          draw();
        }}
        onPointerUp={(e) => {
          const start = origin.current;
          origin.current = null;
          drag.current = null;
          if (!start) return;
          const moved =
            Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
          if (moved < 4) {
            const id = hit(e.clientY);
            if (id) onSelectRef.current(id);
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          cam.current.scale = Math.min(
            2.2,
            Math.max(0.55, cam.current.scale * (e.deltaY < 0 ? 1.06 : 0.94)),
          );
          draw();
        }}
      />
    </div>
  );
}
