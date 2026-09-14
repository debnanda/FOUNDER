import { ARCHETYPES, IDEAS, ROLE_DESC, ROLE_LABEL } from "../game/data";
import {
  appeal, cac, devPoints, fmtMoney, fmtNum, fmtWeek, growthRate, idea, mrr,
  ROUNDS, roundTaken, roundValuation, runwayWeeks, stability, valuation,
  weeklyBurn, weeklyChurnRate, weeklyNet, weeklyOverhead, weeklyRevenue, weeklySalaries
} from "../game/engine";
import { RAISE_COOLDOWN_WEEKS } from "../game/game";
import type { GameState } from "../game/types";
import { renderChart } from "./charts";

export type Tab = "dashboard" | "product" | "team" | "growth" | "money";

export interface UIState {
  tab: Tab;
  speed: number; // 0 pause, 1, 2, 4
  setup: { ideaId: string; archetypeId: string; name: string };
  howTo: boolean;
}

export interface Actions {
  newGame(): void;
  showHowTo(): void;
  hideHowTo(): void;
  setTab(t: Tab): void;
  setSpeed(x: number): void;
  launch(): void;
  setFocus(f: number): void;
  setMarketing(b: number): void;
  toggleCrunch(): void;
  buyPerks(): void;
  hire(id: number): void;
  fire(id: number): void;
  rerollCandidates(): void;
  raise(roundId: string): void;
  fileIPO(): void;
  chooseEvent(i: number): void;
  restart(): void;
}

const el = (html: string): HTMLElement => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ============================== setup screen ============================== */

export function renderSetup(root: HTMLElement, ui: UIState, act: Actions): void {
  root.innerHTML = "";
  const v = el(`<div class="setup">
    <h1>FOUNDER<span>_</span></h1>
    <p class="tag">You have $30,000 in savings, an idea, and a laptop. Build something people want — before the money runs out.</p>
    <div class="grid c2">
      <div class="card">
        <h3>Company name</h3>
        <input id="cname" type="text" maxlength="24" placeholder="Acme Labs" value="${esc(ui.setup.name)}" />
        <h3 class="mt">Who are you?</h3>
        <div id="arch" class="grid" style="gap:8px"></div>
      </div>
      <div class="card">
        <h3>Pick your idea</h3>
        <div id="ideas" class="grid" style="gap:8px"></div>
      </div>
    </div>
    <div class="row mt" style="justify-content:flex-end">
      <button id="howto" style="padding:11px 22px;font-size:0.85rem">📖 How to play</button>
      <button class="primary" id="go" style="padding:11px 30px;font-size:1rem">Found the company</button>
    </div>
  </div>`);

  const ideasBox = v.querySelector("#ideas")!;
  for (const i of IDEAS) {
    const b = el(`<button class="pick card ${ui.setup.ideaId === i.id ? "active" : ""}">
      <span class="t">${i.name}</span>
      <span class="d">${i.tagline}</span>
      <span class="stats">Market ${fmtNum(i.marketSize)} · ARPU $${i.arpu}/mo · MVP effort ${i.mvpPoints < 280 ? "low" : i.mvpPoints < 330 ? "medium" : "high"}</span>
    </button>`);
    b.addEventListener("click", () => { ui.setup.ideaId = i.id; keepName(); renderSetup(root, ui, act); });
    ideasBox.appendChild(b);
  }

  const archBox = v.querySelector("#arch")!;
  for (const a of ARCHETYPES) {
    const b = el(`<button class="pick card ${ui.setup.archetypeId === a.id ? "active" : ""}">
      <span class="t">${a.name}</span>
      <span class="d">${a.blurb}</span>
    </button>`);
    b.addEventListener("click", () => { ui.setup.archetypeId = a.id; keepName(); renderSetup(root, ui, act); });
    archBox.appendChild(b);
  }

  const keepName = () => { ui.setup.name = (v.querySelector("#cname") as HTMLInputElement).value; };
  v.querySelector("#go")!.addEventListener("click", () => { keepName(); act.newGame(); });
  v.querySelector("#howto")!.addEventListener("click", () => { keepName(); act.showHowTo(); });
  root.appendChild(v);
}

/* ============================== how to play ============================== */

function section(title: string, bodyHtml: string): HTMLElement {
  return el(`<div class="card"><h3>${title}</h3>${bodyHtml}</div>`);
}

export function renderHowTo(root: HTMLElement, act: Actions): void {
  root.innerHTML = "";
  const v = el(`<div class="setup howto">
    <h1>HOW TO PLAY<span>_</span></h1>
    <p class="tag">Everything you need to go from a $30k bank balance to an IPO — the rules, the tabs, and a full sample playthrough.</p>
    <div id="sections"></div>
    <div class="row mt" style="justify-content:flex-end">
      <button class="primary" id="back" style="padding:11px 30px;font-size:1rem">← Back to setup</button>
    </div>
  </div>`);

  const box = v.querySelector("#sections")!;

  box.appendChild(section("The goal", `
    <p>You have $30,000 in savings, one idea, and yourself. Build a product, hire a team, grow revenue,
    and reach one of three endings before the money runs out:</p>
    <div class="kv"><span class="k">🔔 IPO</span><span class="v" style="font-weight:400;font-size:.85rem;text-align:right">Reach a $100M valuation <b>and</b> $400k MRR at the same time, then file from the Money tab.</span></div>
    <div class="kv"><span class="k">◆ Acquisition</span><span class="v" style="font-weight:400;font-size:.85rem;text-align:right">Random offers start arriving once MRR passes $20k. Accept one to cash out instantly at your equity share.</span></div>
    <div class="kv"><span class="k">▁ Bankruptcy</span><span class="v" style="font-weight:400;font-size:.85rem;text-align:right">The one to avoid. Cash stays negative for 4 straight weeks and it's over.</span></div>
  `));

  box.appendChild(section("Time & controls", `
    <p>The game runs in weekly ticks, roughly 1.6 seconds per week at 1× speed.</p>
    <div class="kv"><span class="k">Space</span><span class="v">Pause / resume</span></div>
    <div class="kv"><span class="k">1 / 2 / 3</span><span class="v">1× / 2× / 4× speed</span></div>
    <p class="hint">Progress autosaves to your browser every 4 game-weeks, so you can close and pick up where you left off.</p>
  `));

  box.appendChild(section("Setup: idea & archetype", `
    <p><b>Idea</b> sets your market size, price per user (ARPU), how viral it spreads, free→paying conversion,
    infrastructure cost per user, and how many dev points the MVP needs before you can launch. Bigger markets
    (social apps) pay less per user; niche B2B tools (fintech, dev tools) pay more but grow slower.</p>
    <p><b>Archetype</b> decides your own starting skill: the Hacker begins as a skill-8 engineer, the Hustler a
    skill-8 marketer, the Craftsman a skill-8 designer. You're the company's first employee and never draw a salary.</p>
  `));

  box.appendChild(section("Product tab", `
    <p>Engineers generate <b>dev points</b> each week (skill × morale × 2.1, plus 45% while crunching). The
    <b>focus slider</b> splits that output between shipping features (fills the MVP bar, then raises product appeal)
    and stability work.</p>
    <p>Feature work piles up <b>tech debt</b>; stability work pays it down. High debt drives up weekly churn and
    triggers outage events, so don't leave the slider pinned at 100% features forever — especially after launch.</p>
    <p>Once progress reaches the idea's MVP threshold, hit <b>🚀 Launch v1.0</b>. Launch seeds you with ~150-350
    curious early users and switches on the growth engine.</p>
    <p><b>Crunch mode</b> gives +45% output but drains morale fast — people quit once morale bottoms out. Use it
    in short bursts before a launch or a raise, not as a steady state.</p>
  `));

  box.appendChild(section("Team tab", `
    <p>Four roles: <b>Engineers</b> build the product; <b>Designers</b> raise appeal and cut churn; <b>Marketers</b>
    stretch every ad dollar further (lower CAC); <b>Sales</b> convert more free users into paying ones.</p>
    <p>Hire from a rotating pool of 4 candidates (refreshes automatically every 6 weeks, or pay $1k for a fresh
    batch anytime). Firing costs one month's severance and dents everyone else's morale.</p>
    <p>Morale drifts toward a 68 baseline, pulled up by office perks and down by crunch or negative cash. Anyone
    below ~22 morale risks burning out and quitting on their own. <b>Office perks</b> (4 levels, one-time purchase
    each) raise the morale ceiling for the whole team at a permanently higher weekly rent.</p>
  `));

  box.appendChild(section("Growth tab", `
    <p>Set a weekly <b>marketing budget</b>; it buys new users at your current <b>CAC</b>, which starts around
    $14/user and climbs as you saturate more of the total market — marketers push it back down.</p>
    <p><b>Organic growth</b> comes from word of mouth: existing users × the idea's virality × product appeal.
    <b>Churn</b> is driven mostly by tech debt (designers reduce it). Watch the funnel card for paying customers,
    ARPU, and churn rate directly.</p>
  `));

  box.appendChild(section("Money tab", `
    <p>Four funding rounds, each sold for newly-issued equity that dilutes you and every existing investor:</p>
    <div class="kv"><span class="k">Pre-seed</span><span class="v" style="font-weight:400">10% · always open · priced at a flat $1.5M</span></div>
    <div class="kv"><span class="k">Seed</span><span class="v" style="font-weight:400">15% · needs launch + 2,000 users</span></div>
    <div class="kv"><span class="k">Series A</span><span class="v" style="font-weight:400">18% · needs $60k+ MRR</span></div>
    <div class="kv"><span class="k">Series B</span><span class="v" style="font-weight:400">15% · needs $300k+ MRR</span></div>
    <p class="hint">One raise every ${RAISE_COOLDOWN_WEEKS} weeks. Later rounds price off your live valuation, so growth before raising pays off directly.</p>
  `));

  box.appendChild(section("Random events", `
    <p>From launch onward there's roughly a 13% chance each week of an event modal (5% pre-launch): press
    features, viral moments, outages, a funded competitor, poach attempts on your best people, enterprise
    contract offers, and acquisition offers. Each gives you a real choice with trade-offs — e.g. do the press
    interview and risk a live crash, or pass quietly; fight an outage with an all-hands (morale hit, debt paid
    down) or patch it and eat the churn. There's no single right answer — weigh it against your cash and stability.</p>
  `));

  box.appendChild(section("Walkthrough — one full run", `
    <p><b>Week 0 — Found.</b> Name the company, pick the Hacker (skill-8 engineer) and ShipFast (devtools:
    260 MVP points, $38 ARPU, 2.5M market). You start solo with $30k and default 75% feature focus.</p>
    <p><b>Weeks 1-8 — Build the MVP.</b> Hire 1-2 more engineers as cash allows (Team tab, reroll candidates for
    $1k if the pool's thin). Keep an eye on tech debt — nudge focus toward stability if it creeps past ~40 so
    launch doesn't start with a churn problem. Progress crosses 260 points; the Product tab lights up
    <b>🚀 Launch v1.0</b>.</p>
    <p><b>Week ~8 — Launch.</b> Click launch. ~150-350 early users show up immediately and the growth engine
    turns on: marketing spend and organic word of mouth start moving the user count.</p>
    <p><b>Weeks 9-20 — Find the growth loop.</b> On Growth, start with a modest marketing budget ($2-5k/week) —
    CAC is cheapest before you've saturated the market. Hire a designer to lift appeal and cut churn; take a
    Pre-seed raise early if cash is tight ($150k for 10% at a $1.5M valuation). Handle whatever events show up —
    accept press once stability is comfortably above 55, amplify a viral moment with paid ads if you can afford it.</p>
    <p><b>Weeks 20-50 — Raise and scale.</b> Cross 2,000 users to unlock Seed; push MRR past $60k for Series A.
    Put fresh capital into more engineers (features + debt paydown), a second designer, and marketers/sales to
    compound growth and conversion. Keep focus balanced — pure feature-mode after launch will bury you in churn.</p>
    <p><b>Weeks 50-100+ — Push for the exit.</b> Keep MRR and valuation climbing toward Series B ($300k+ MRR).
    Watch for acquisition offers once MRR passes $20k — a strong early offer can be a legitimate win if the
    payout is good. Otherwise keep compounding until valuation clears $100M <i>and</i> MRR clears $400k, then
    file for IPO from the Money tab.</p>
    <p><b>Staying alive.</b> If a bad stretch pushes cash negative, you get a 4-week grace window before
    bankruptcy. Cut the marketing budget, pause hiring, and lean on any open funding round to get back to
    positive net before the clock runs out.</p>
  `));

  v.querySelector("#back")!.addEventListener("click", () => act.hideHowTo());
  root.appendChild(v);
}

/* ============================== game over ============================== */

export function renderGameOver(root: HTMLElement, s: GameState, act: Actions): void {
  const go = s.gameOver!;
  root.innerHTML = "";
  const icon = go.type === "bankrupt" ? "▁" : go.type === "acquired" ? "◆" : "▲";
  const color = go.type === "bankrupt" ? "var(--red)" : go.type === "acquired" ? "var(--violet)" : "var(--green)";
  const v = el(`<div class="gameover">
    <div style="font-size:2.6rem;color:${color}">${icon}</div>
    <h1>${esc(go.title)}</h1>
    <p>${esc(go.body)}</p>
    ${go.payout > 0 ? `<div class="payout" style="color:${color}">${fmtMoney(go.payout)}</div>` : ""}
    <div class="card mt" style="text-align:left">
      <div class="kv"><span class="k">Survived</span><span class="v">${fmtWeek(s.week)}</span></div>
      <div class="kv"><span class="k">Peak users</span><span class="v">${fmtNum(Math.max(...s.history.map((h) => h.users)))}</span></div>
      <div class="kv"><span class="k">Peak MRR</span><span class="v">${fmtMoney(Math.max(...s.history.map((h) => h.mrr)))}</span></div>
      <div class="kv"><span class="k">Team size</span><span class="v">${s.team.length}</span></div>
      <div class="kv"><span class="k">Final founder equity</span><span class="v">${(s.founderEquity * 100).toFixed(1)}%</span></div>
    </div>
    <button class="primary mt" style="margin-top:22px;padding:11px 30px" id="again">Start a new company</button>
  </div>`);
  v.querySelector("#again")!.addEventListener("click", () => act.restart());
  root.appendChild(v);
}

/* ============================== main frame ============================== */

export function renderGame(root: HTMLElement, s: GameState, ui: UIState, act: Actions): void {
  // Don't yank inputs out from under the user mid-interaction.
  const ae = document.activeElement;
  const interacting = ae instanceof HTMLInputElement && root.contains(ae);
  if (interacting) {
    const top = root.querySelector(".topbar");
    if (top) top.replaceWith(topbar(s, ui, act));
    renderModal(root, s, act);
    return;
  }

  root.innerHTML = "";
  const frame = el(`<div id="frame" style="height:100%;display:flex;flex-direction:column"></div>`);
  frame.appendChild(topbar(s, ui, act));

  const body = el(`<div class="body"></div>`);
  const rail = el(`<nav class="rail"></nav>`);
  const tabs: [Tab, string][] = [
    ["dashboard", "Dashboard"],
    ["product", "Product"],
    ["team", "Team"],
    ["growth", "Growth"],
    ["money", "Money"]
  ];
  for (const [t, label] of tabs) {
    const b = el(`<button class="${ui.tab === t ? "active" : ""}">${label}</button>`);
    b.addEventListener("click", () => act.setTab(t));
    rail.appendChild(b);
  }
  rail.appendChild(el(`<div class="spacer"></div>`));
  const hint = el(`<div class="hint" style="padding:0 12px 8px">Space — pause/play<br/>1/2/3 — speed</div>`);
  rail.appendChild(hint);
  body.appendChild(rail);

  const main = el(`<div class="main"></div>`);
  switch (ui.tab) {
    case "dashboard": dashboard(main, s); break;
    case "product": productTab(main, s, act); break;
    case "team": teamTab(main, s, act); break;
    case "growth": growthTab(main, s, act); break;
    case "money": moneyTab(main, s, act); break;
  }
  body.appendChild(main);
  frame.appendChild(body);
  root.appendChild(frame);

  renderModal(root, s, act);
}

function topbar(s: GameState, ui: UIState, act: Actions): HTMLElement {
  const rw = runwayWeeks(s);
  const runway = rw === Infinity ? "profitable" : `${Math.round(rw / 4.33)} mo runway`;
  const g = growthRate(s);
  const bar = el(`<header class="topbar">
    <div class="brand">FOUNDER<span>_</span></div>
    <div class="top-stat"><span class="k">${esc(s.companyName)}</span><span class="v" style="font-size:.9rem">${fmtWeek(s.week)}</span></div>
    <div class="top-stat"><span class="k">Cash</span><span class="v ${s.cash < 0 ? "neg" : ""}">${fmtMoney(s.cash)}<small>${runway}</small></span></div>
    <div class="top-stat"><span class="k">Users</span><span class="v">${fmtNum(s.users)}<small>${s.product.launched ? `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}%/wk` : "pre-launch"}</small></span></div>
    <div class="top-stat"><span class="k">MRR</span><span class="v">${fmtMoney(mrr(s))}</span></div>
    <div class="top-stat"><span class="k">Your equity</span><span class="v">${(s.founderEquity * 100).toFixed(1)}%</span></div>
    <div class="speed" id="speed"></div>
  </header>`);
  const speeds: [number, string][] = [[0, "❚❚"], [1, "▶"], [2, "▶▶"], [4, "▶▶▶"]];
  const box = bar.querySelector("#speed")!;
  for (const [x, label] of speeds) {
    const b = el(`<button class="${ui.speed === x ? "active" : ""}" title="${x === 0 ? "Pause" : `${x}× speed`}">${label}</button>`);
    b.addEventListener("click", () => act.setSpeed(x));
    box.appendChild(b);
  }
  return bar;
}

/* ============================== tabs ============================== */

function dashboard(main: HTMLElement, s: GameState): void {
  main.appendChild(el(`<h2>Dashboard</h2>`));
  main.appendChild(el(`<p class="sub">${esc(idea(s).name)} — ${esc(idea(s).tagline)}</p>`));

  const charts = el(`<div class="grid c3"></div>`);
  const specs = [
    { title: "Cash", color: "var(--green)", key: "cash" as const, fmt: fmtMoney },
    { title: "Users", color: "var(--blue)", key: "users" as const, fmt: fmtNum },
    { title: "MRR", color: "var(--orange)", key: "mrr" as const, fmt: fmtMoney }
  ];
  for (const sp of specs) {
    const card = el(`<div class="card"></div>`);
    card.appendChild(renderChart({
      title: sp.title,
      color: sp.color,
      fmt: sp.fmt,
      points: s.history.map((h) => ({ week: h.week, value: h[sp.key] }))
    }));
    charts.appendChild(card);
  }
  main.appendChild(charts);

  const tiles = el(`<div class="grid c3 mt"></div>`);
  const ap = appeal(s), st = stability(s);
  tiles.appendChild(el(`<div class="card tile">
    <h3>Product appeal</h3><div class="big">${ap}<small style="font-size:.9rem;color:var(--ink-3)">/100</small></div>
    <div class="meter"><div style="width:${ap}%;background:var(--blue)"></div></div>
  </div>`));
  tiles.appendChild(el(`<div class="card tile">
    <h3>Stability</h3><div class="big">${st}<small style="font-size:.9rem;color:var(--ink-3)">/100</small></div>
    <div class="meter"><div style="width:${st}%;background:${st < 50 ? "var(--orange)" : "var(--green)"}"></div></div>
  </div>`));
  const net = weeklyNet(s);
  tiles.appendChild(el(`<div class="card tile">
    <h3>Weekly net</h3><div class="big" style="color:${net >= 0 ? "var(--ink)" : "var(--red)"}">${net >= 0 ? "+" : ""}${fmtMoney(net)}</div>
    <div class="delta">${fmtMoney(weeklyRevenue(s))} in · ${fmtMoney(weeklyBurn(s))} out</div>
  </div>`));
  main.appendChild(tiles);

  const logCard = el(`<div class="card mt"><h3>Company log</h3><div class="log"></div></div>`);
  const logBox = logCard.querySelector(".log")!;
  if (s.log.length === 0) logBox.appendChild(el(`<div class="hint">Nothing yet. Get building.</div>`));
  for (const entry of s.log) {
    logBox.appendChild(el(`<div class="entry"><span class="wk">${fmtWeek(entry.week)}</span><span class="${entry.kind}">${esc(entry.msg)}</span></div>`));
  }
  main.appendChild(logCard);
}

function productTab(main: HTMLElement, s: GameState, act: Actions): void {
  const id = idea(s);
  main.appendChild(el(`<h2>Product</h2>`));
  main.appendChild(el(`<p class="sub">Weekly engineering output: ${devPoints(s).toFixed(1)} points ${s.crunch ? "· CRUNCH ACTIVE" : ""}</p>`));

  const grid = el(`<div class="grid c2"></div>`);

  const prog = s.product.progress;
  const pct = Math.min(100, (prog / id.mvpPoints) * 100);
  const launchCard = el(`<div class="card">
    <h3>${s.product.launched ? `Version ${s.product.version} — live` : "MVP progress"}</h3>
    ${s.product.launched
      ? `<div class="tile"><div class="big">${appeal(s)}<small style="font-size:.9rem;color:var(--ink-3)"> appeal</small></div>
         <div class="delta">Keep shipping features to raise appeal. Diminishing returns — hire designers for polish.</div></div>`
      : `<div class="tile"><div class="big">${Math.floor(pct)}%</div></div>
         <div class="meter"><div style="width:${pct}%;background:var(--blue)"></div></div>
         <p class="hint mt">Reach ${id.mvpPoints} dev points to launch. Currently ${Math.floor(prog)}.</p>
         <button class="primary mt" id="launch" ${prog >= id.mvpPoints ? "" : "disabled"}>🚀 Launch ${esc(s.companyName)} v1.0</button>`}
  </div>`);
  launchCard.querySelector("#launch")?.addEventListener("click", () => act.launch());
  grid.appendChild(launchCard);

  const st = stability(s);
  const focusPct = Math.round(s.product.focus * 100);
  const focusCard = el(`<div class="card">
    <h3>Engineering focus</h3>
    <div class="row" style="justify-content:space-between;font-size:.8rem;color:var(--ink-2)">
      <span>Stability ${100 - focusPct}%</span><span>Features ${focusPct}%</span>
    </div>
    <input type="range" min="0" max="100" step="5" value="${focusPct}" id="focus"/>
    <div class="mt">
      <div class="row" style="justify-content:space-between;font-size:.85rem"><span>Tech debt</span><b>${Math.round(s.product.techDebt)}/100</b></div>
      <div class="meter"><div style="width:${s.product.techDebt}%;background:${s.product.techDebt > 50 ? "var(--red)" : "var(--orange)"}"></div></div>
      <p class="hint mt">Feature work accrues tech debt; stability work pays it down. High debt means churn and outages. Stability: ${st}/100.</p>
    </div>
  </div>`);
  focusCard.querySelector("#focus")!.addEventListener("input", (e) => {
    act.setFocus(Number((e.target as HTMLInputElement).value) / 100);
  });
  grid.appendChild(focusCard);

  const crunchCard = el(`<div class="card">
    <h3>Crunch mode</h3>
    <p class="hint">+45% output while active. Morale drains fast — people quit when it hits bottom.</p>
    <button class="${s.crunch ? "danger" : ""} mt" id="crunch">${s.crunch ? "End crunch" : "Start crunch"}</button>
  </div>`);
  crunchCard.querySelector("#crunch")!.addEventListener("click", () => act.toggleCrunch());
  grid.appendChild(crunchCard);

  main.appendChild(grid);
}

function moraleColor(m: number): string {
  return m > 60 ? "var(--green)" : m > 35 ? "var(--orange)" : "var(--red)";
}

function teamTab(main: HTMLElement, s: GameState, act: Actions): void {
  main.appendChild(el(`<h2>Team</h2>`));
  main.appendChild(el(`<p class="sub">${s.team.length} people · payroll ${fmtMoney(weeklySalaries(s) * 4.33)}/mo</p>`));

  const grid = el(`<div class="grid c2"></div>`);

  const roster = el(`<div class="card"><h3>Roster</h3><div class="grid" style="gap:8px" id="roster"></div></div>`);
  const rbox = roster.querySelector("#roster")!;
  for (const e of s.team) {
    const initials = e.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
    const card = el(`<div class="person">
      <div class="avatar role-${e.role}">${esc(initials)}</div>
      <div class="info">
        <div class="name">${esc(e.name)} ${e.isFounder ? `<span class="pill">founder</span>` : ""}</div>
        <div class="meta">${ROLE_LABEL[e.role]} · skill ${e.skill} · ${e.isFounder ? "no salary" : `${fmtMoney(e.salary)}/yr`}</div>
      </div>
      <div class="morale">
        <div class="k">Morale ${Math.round(e.morale)}</div>
        <div class="meter"><div style="width:${e.morale}%;background:${moraleColor(e.morale)}"></div></div>
      </div>
      ${e.isFounder ? "" : `<button class="danger" data-fire="${e.id}" title="1 month severance">✕</button>`}
    </div>`);
    card.querySelector("[data-fire]")?.addEventListener("click", () => act.fire(e.id));
    rbox.appendChild(card);
  }
  grid.appendChild(roster);

  const right = el(`<div class="grid" style="gap:14px;align-content:start"></div>`);

  const hiring = el(`<div class="card">
    <h3>Candidates <button style="float:right;font-size:.75rem;padding:4px 10px" id="reroll">New batch — $1k</button></h3>
    <div class="grid" style="gap:8px" id="cands"></div>
  </div>`);
  hiring.querySelector("#reroll")!.addEventListener("click", () => act.rerollCandidates());
  const cbox = hiring.querySelector("#cands")!;
  if (s.candidates.length === 0) cbox.appendChild(el(`<div class="hint">No candidates right now — the pool refreshes every 6 weeks, or pay a recruiter.</div>`));
  for (const c of s.candidates) {
    const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
    const card = el(`<div class="person">
      <div class="avatar role-${c.role}">${esc(initials)}</div>
      <div class="info">
        <div class="name">${esc(c.name)}</div>
        <div class="meta">${ROLE_LABEL[c.role]} · skill ${c.skill} · asks ${fmtMoney(c.salary)}/yr</div>
      </div>
      <button class="primary" data-hire="${c.id}">Hire</button>
    </div>`);
    card.querySelector("[data-hire]")!.addEventListener("click", () => act.hire(c.id));
    cbox.appendChild(card);
  }
  right.appendChild(hiring);

  const perkNames = ["Bare office", "Good coffee & gear", "Catered lunches", "Dream office"];
  const perkCost = [8_000, 20_000, 45_000][s.perks];
  const perks = el(`<div class="card">
    <h3>Office & perks</h3>
    <div class="kv"><span class="k">Current</span><span class="v">${perkNames[s.perks]} (level ${s.perks}/3)</span></div>
    <p class="hint">Each level lifts weekly morale for everyone, at a higher rent.</p>
    ${s.perks < 3 ? `<button class="mt" id="perk" ${s.cash < perkCost ? "disabled" : ""}>Upgrade — ${fmtMoney(perkCost)}</button>` : ""}
  </div>`);
  perks.querySelector("#perk")?.addEventListener("click", () => act.buyPerks());
  right.appendChild(perks);

  const roleHelp = el(`<div class="card"><h3>Roles</h3>${(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[])
    .map((r) => `<div class="kv"><span class="k">${ROLE_LABEL[r]}</span><span class="v" style="font-weight:400;font-size:.78rem;color:var(--ink-2);text-align:right;max-width:70%">${ROLE_DESC[r]}</span></div>`)
    .join("")}</div>`);
  right.appendChild(roleHelp);

  grid.appendChild(right);
  main.appendChild(grid);
}

function growthTab(main: HTMLElement, s: GameState, act: Actions): void {
  const id = idea(s);
  main.appendChild(el(`<h2>Growth</h2>`));
  main.appendChild(el(`<p class="sub">${s.product.launched ? `Market penetration ${((s.users / id.marketSize) * 100).toFixed(2)}% of ${fmtNum(id.marketSize)}` : "Launch first — growth starts when the product is live."}</p>`));

  const grid = el(`<div class="grid c2"></div>`);

  const mk = el(`<div class="card">
    <h3>Marketing budget</h3>
    <div class="tile"><div class="big">${fmtMoney(s.marketingBudget)}<small style="font-size:.85rem;color:var(--ink-3)">/week</small></div></div>
    <input type="range" min="0" max="50000" step="500" value="${s.marketingBudget}" id="mkt"/>
    <div class="kv"><span class="k">Blended CAC</span><span class="v">${fmtMoney(cac(s))}/user</span></div>
    <div class="kv"><span class="k">Paid signups</span><span class="v">${s.marketingBudget > 0 ? `~${fmtNum(s.marketingBudget / cac(s))}/wk` : "—"}</span></div>
    <p class="hint">CAC rises as you saturate the market. Marketers stretch every dollar further.</p>
  </div>`);
  mk.querySelector("#mkt")!.addEventListener("input", (e) => {
    act.setMarketing(Number((e.target as HTMLInputElement).value));
  });
  grid.appendChild(mk);

  const churn = weeklyChurnRate(s);
  const funnel = el(`<div class="card">
    <h3>Funnel</h3>
    <div class="kv"><span class="k">Active users</span><span class="v">${fmtNum(s.users)}</span></div>
    <div class="kv"><span class="k">Paying customers</span><span class="v">${fmtNum(s.payingUsers)} (${s.users > 0 ? ((s.payingUsers / s.users) * 100).toFixed(1) : "0"}%)</span></div>
    <div class="kv"><span class="k">ARPU</span><span class="v">$${id.arpu}/mo</span></div>
    <div class="kv"><span class="k">Weekly churn</span><span class="v" style="color:${churn > 0.05 ? "var(--red)" : "var(--ink)"}">${(churn * 100).toFixed(1)}%</span></div>
    <div class="kv"><span class="k">Word of mouth</span><span class="v">${(id.virality * (appeal(s) / 100) * 100).toFixed(1)}%/wk</span></div>
    <p class="hint">Churn is driven by tech debt${s.modifiers.some((m) => m.kind === "churn") ? " — and a competitor is currently making it worse" : ""}. Designers cut churn; sales lift conversion.</p>
  </div>`);
  grid.appendChild(funnel);

  if (s.modifiers.length > 0) {
    const fx = el(`<div class="card"><h3>Active effects</h3>${s.modifiers
      .map((m) => `<div class="kv"><span class="k">${m.kind === "churn" ? "Elevated churn" : m.kind === "press" ? "Press coverage" : "Organic boost"}</span><span class="v">${m.weeksLeft} wk left</span></div>`)
      .join("")}</div>`);
    grid.appendChild(fx);
  }

  main.appendChild(grid);
}

function moneyTab(main: HTMLElement, s: GameState, act: Actions): void {
  main.appendChild(el(`<h2>Money</h2>`));
  main.appendChild(el(`<p class="sub">Valuation ${fmtMoney(valuation(s))} · you own ${(s.founderEquity * 100).toFixed(1)}%</p>`));

  const grid = el(`<div class="grid c2"></div>`);

  const rev = weeklyRevenue(s), sal = weeklySalaries(s), ovh = weeklyOverhead(s), net = weeklyNet(s);
  const pnl = el(`<div class="card">
    <h3>Weekly P&amp;L</h3>
    <div class="kv"><span class="k">Revenue</span><span class="v" style="color:var(--green)">+${fmtMoney(rev)}</span></div>
    <div class="kv"><span class="k">Salaries</span><span class="v">−${fmtMoney(sal)}</span></div>
    <div class="kv"><span class="k">Office & infra</span><span class="v">−${fmtMoney(ovh)}</span></div>
    <div class="kv"><span class="k">Marketing</span><span class="v">−${fmtMoney(s.marketingBudget)}</span></div>
    <div class="kv"><span class="k"><b>Net</b></span><span class="v" style="color:${net >= 0 ? "var(--green)" : "var(--red)"}">${net >= 0 ? "+" : ""}${fmtMoney(net)}</span></div>
    <div class="kv"><span class="k">Runway</span><span class="v">${runwayWeeks(s) === Infinity ? "∞ — profitable" : `~${Math.round(runwayWeeks(s) / 4.33)} months`}</span></div>
  </div>`);
  grid.appendChild(pnl);

  const cap = el(`<div class="card">
    <h3>Cap table</h3>
    <div class="kv"><span class="k">You (founder)</span><span class="v">${(s.founderEquity * 100).toFixed(1)}%</span></div>
    ${s.investors
      .map((i) => `<div class="kv"><span class="k">${ROUNDS.find((r) => r.id === i.round)?.name ?? i.round} investors <span class="pill">${fmtMoney(i.amount)} @ ${fmtMoney(i.valuation)}</span></span><span class="v">${(i.equityPct * 100).toFixed(1)}%</span></div>`)
      .join("")}
  </div>`);
  grid.appendChild(cap);

  const funding = el(`<div class="card"><h3>Raise capital</h3><div class="grid" style="gap:8px" id="rounds"></div>
    <p class="hint mt">Raising sells new equity and dilutes everyone. One raise every ${RAISE_COOLDOWN_WEEKS} weeks.</p></div>`);
  const rbox = funding.querySelector("#rounds")!;
  const cooldown = s.investors.length > 0 && s.week - s.lastRaiseWeek < RAISE_COOLDOWN_WEEKS;
  for (const r of ROUNDS) {
    const taken = roundTaken(s, r.id);
    const open = r.unlocked(s);
    const val = roundValuation(s, r.id);
    const amount = Math.round((val * r.targetPct) / 10_000) * 10_000;
    const b = el(`<div class="person" style="align-items:center">
      <div class="info">
        <div class="name">${r.name} ${taken ? `<span class="pill">closed</span>` : ""}</div>
        <div class="meta">${taken ? `Raised ${fmtMoney(s.investors.find((i) => i.round === r.id)!.amount)}` : open ? `${fmtMoney(amount)} for ${(r.targetPct * 100).toFixed(0)}% at ${fmtMoney(val)} post` : r.requirement}</div>
      </div>
      ${!taken ? `<button class="primary" data-r="${r.id}" ${open && !cooldown ? "" : "disabled"}>${cooldown && open ? "Cooling down" : "Raise"}</button>` : ""}
    </div>`);
    b.querySelector("[data-r]")?.addEventListener("click", () => act.raise(r.id));
    rbox.appendChild(b);
  }
  grid.appendChild(funding);

  const ipoReady = valuation(s) >= 100_000_000 && mrr(s) >= 400_000;
  const exit = el(`<div class="card">
    <h3>The endgame</h3>
    <div class="kv"><span class="k">IPO requires</span><span class="v" style="font-weight:400;font-size:.8rem;color:var(--ink-2)">$100M valuation · $400k MRR</span></div>
    <div class="kv"><span class="k">Valuation</span><span class="v">${fmtMoney(valuation(s))} / $100M</span></div>
    <div class="kv"><span class="k">MRR</span><span class="v">${fmtMoney(mrr(s))} / $400k</span></div>
    <button class="primary mt" id="ipo" ${ipoReady ? "" : "disabled"}>🔔 File for IPO</button>
    <p class="hint mt">Or wait for an acquisition offer — they come knocking once MRR passes $20k.</p>
  </div>`);
  exit.querySelector("#ipo")!.addEventListener("click", () => act.fileIPO());
  grid.appendChild(exit);

  main.appendChild(grid);
}

/* ============================== event modal ============================== */

function renderModal(root: HTMLElement, s: GameState, act: Actions): void {
  root.querySelector(".overlay")?.remove();
  if (!s.pendingEvent) return;
  const ev = s.pendingEvent;
  const overlay = el(`<div class="overlay"><div class="modal">
    <h2>${esc(ev.title)}</h2>
    <p>${esc(ev.body)}</p>
    <div id="choices"></div>
  </div></div>`);
  const box = overlay.querySelector("#choices")!;
  ev.choices.forEach((c, i) => {
    const b = el(`<button class="choice">${esc(c.label)}<span class="d">${esc(c.detail)}</span></button>`);
    b.addEventListener("click", () => act.chooseEvent(i));
    box.appendChild(b);
  });
  root.appendChild(overlay);
}
