/** Minimal single-series line chart: SVG, recessive grid, crosshair + tooltip. */

export interface ChartSpec {
  title: string;
  color: string;
  points: { week: number; value: number }[];
  fmt: (v: number) => string;
}

const W = 340;
const H = 120;
const PAD = { l: 6, r: 52, t: 10, b: 6 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function renderChart(spec: ChartSpec): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";

  const pts = spec.points.slice(-104); // last 2 years
  const values = pts.map((p) => p.value);
  const rawMin = Math.min(0, ...values);
  const max = niceMax(Math.max(1, ...values));
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;

  const x = (i: number) => PAD.l + (i / Math.max(1, pts.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);

  // Stepped path (pixel look): horizontal run, then vertical rise at each point.
  const path = pts
    .map((p, i) => (i === 0 ? `M${x(0).toFixed(1)},${y(p.value).toFixed(1)}` : `H${x(i).toFixed(1)} V${y(p.value).toFixed(1)}`))
    .join(" ");

  const gridLines = [max, (max + min) / 2, min]
    .map(
      (v) => `<g>
        <line x1="${PAD.l}" x2="${W - PAD.r + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
              stroke="var(--border)" stroke-width="1" stroke-dasharray="${v === min && min === 0 ? "" : "3 4"}"/>
        <text x="${W - PAD.r + 8}" y="${(y(v) + 3.5).toFixed(1)}" fill="var(--ink-3)" font-size="9.5">${spec.fmt(v)}</text>
      </g>`
    )
    .join("");

  const last = pts[pts.length - 1];
  const endDot = last
    ? `<rect x="${(x(pts.length - 1) - 3.5).toFixed(1)}" y="${(y(last.value) - 3.5).toFixed(1)}" width="7" height="7" fill="${spec.color}" stroke="var(--surface)" stroke-width="2"/>`
    : "";

  wrap.innerHTML = `
    <h3 style="margin:0 0 6px;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-2)">
      ${spec.title}
      <span style="float:right;color:var(--ink);font-size:.85rem;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums">
        ${last ? spec.fmt(last.value) : "—"}
      </span>
    </h3>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${spec.title} over time">
      ${gridLines}
      <path d="${path}" fill="none" stroke="${spec.color}" stroke-width="2.5" shape-rendering="crispEdges" vector-effect="non-scaling-stroke"/>
      ${endDot}
      <line class="xhair" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--ink-3)" stroke-width="1" shape-rendering="crispEdges" opacity="0"/>
      <rect class="xdot" width="7" height="7" fill="${spec.color}" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    </svg>
    <div class="chart-tip"></div>`;

  const svg = wrap.querySelector("svg")!;
  const tip = wrap.querySelector<HTMLElement>(".chart-tip")!;
  const xhair = wrap.querySelector<SVGLineElement>(".xhair")!;
  const xdot = wrap.querySelector<SVGRectElement>(".xdot")!;

  svg.addEventListener("mousemove", (ev) => {
    if (pts.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((ev.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1));
    const idx = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[idx];
    const cx = x(idx);
    const cy = y(p.value);
    xhair.setAttribute("x1", `${cx}`);
    xhair.setAttribute("x2", `${cx}`);
    xhair.setAttribute("opacity", "1");
    xdot.setAttribute("x", `${cx - 3.5}`);
    xdot.setAttribute("y", `${cy - 3.5}`);
    xdot.setAttribute("opacity", "1");
    tip.style.display = "block";
    tip.style.left = `${(cx / W) * rect.width}px`;
    tip.style.top = `${(cy / H) * rect.height}px`;
    tip.innerHTML = `W${p.week} &nbsp; <b>${spec.fmt(p.value)}</b>`;
  });
  svg.addEventListener("mouseleave", () => {
    tip.style.display = "none";
    xhair.setAttribute("opacity", "0");
    xdot.setAttribute("opacity", "0");
  });

  return wrap;
}
