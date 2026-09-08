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

const ROW = 28;
const COL = 22;
const PAD_X = 28;
const PAD_Y = 20;
const R = 5.5;

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

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, w, h);

    const { x: cx, y: cy, scale } = cam.current;
    const list = commitsRef.current;
    if (list.length === 0) return;

    const rowH = ROW * scale;
    const first = Math.max(0, Math.floor((-cy - PAD_Y * scale) / rowH) - 1);
    const last = Math.min(list.length - 1, Math.ceil((-cy + h + PAD_Y * scale) / rowH) + 1);
    const map = byIdRef.current;
    const sel = selectedRef.current;

    ctx.lineWidth = Math.max(1, 1.25 * scale);
    ctx.strokeStyle = "#5c5c5c";
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
        if (py < -40 && y < -40) continue;
        if (py > h + 40 && y > h + 40) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x, (y + py) / 2, px, (y + py) / 2, px, py);
        ctx.stroke();
      }
    }

    for (let i = first; i <= last; i++) {
      const c = list[i];
      if (!c) continue;
      const x = PAD_X + c.lane * COL * scale + cx;
      const y = PAD_Y + c.row * ROW * scale + cy;
      ctx.beginPath();
      ctx.arc(x, y, R * scale, 0, Math.PI * 2);
      ctx.fillStyle = c.id === sel ? "#f4f1ea" : "#d4a017";
      ctx.fill();
      if (c.id === sel) {
        ctx.strokeStyle = "#d4a017";
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.stroke();
      }
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

  function hit(clientX: number, clientY: number): string | null {
    const rect = ref.current!.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const { x: cx, y: cy, scale } = cam.current;
    const list = commitsRef.current;
    const row = worldRow(clientY);
    const lo = Math.max(0, Math.floor(row) - 2);
    const hi = Math.min(list.length - 1, Math.ceil(row) + 2);
    const rad = (R + 4) * scale;
    for (let i = lo; i <= hi; i++) {
      const c = list[i];
      const x = PAD_X + c.lane * COL * scale + cx;
      const y = PAD_Y + c.row * ROW * scale + cy;
      const dx = lx - x;
      const dy = ly - y;
      if (dx * dx + dy * dy <= rad * rad) return c.id;
    }
    return null;
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
            const id = hit(e.clientX, e.clientY);
            if (id) onSelectRef.current(id);
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          const next = Math.min(2.4, Math.max(0.45, cam.current.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
          cam.current.scale = next;
          draw();
        }}
      />
    </div>
  );
}
