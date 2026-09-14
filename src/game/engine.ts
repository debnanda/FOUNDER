import { IDEAS } from "./data";
import type { GameState, Idea, Modifier } from "./types";
import { maybeSpawnEvent } from "./events";

// Swappable RNG: the game always uses Math.random, but headless tools (scripts/sim.ts)
// can install a seeded generator via setRand() to get reproducible balance runs.
let randFn: () => number = Math.random;
export function rand(): number {
  return randFn();
}
export function setRand(fn: () => number): void {
  randFn = fn;
}

export function idea(s: GameState): Idea {
  return IDEAS.find((i) => i.id === s.ideaId)!;
}

export function moraleFactor(m: number): number {
  return 0.55 + (m / 100) * 0.55; // 0.55 .. 1.10
}

function roleOutput(s: GameState, role: string): number {
  let total = 0;
  for (const e of s.team) {
    if (e.role !== role) continue;
    total += e.skill * moraleFactor(e.morale) * (s.crunch ? 1.45 : 1);
  }
  return total;
}

/** Weekly engineering points split between features and stability. */
export function devPoints(s: GameState): number {
  return roleOutput(s, "engineer") * 2.1;
}

export function designPower(s: GameState): number {
  return roleOutput(s, "designer");
}

export function marketingPower(s: GameState): number {
  return roleOutput(s, "marketer");
}

export function salesPower(s: GameState): number {
  return roleOutput(s, "sales");
}

export function stability(s: GameState): number {
  return Math.round(100 - s.product.techDebt);
}

/** Product appeal 0..100, diminishing returns on raw progress, boosted by design. */
export function appeal(s: GameState): number {
  const base = 100 * (s.product.progress / (s.product.progress + 420));
  const polish = Math.min(14, designPower(s) * 0.9);
  return Math.min(100, Math.round(base + polish));
}

export function mrr(s: GameState): number {
  return s.payingUsers * idea(s).arpu;
}

/** Blended customer acquisition cost, worsens with market penetration. */
export function cac(s: GameState): number {
  const pen = s.users / idea(s).marketSize;
  const base = 14 + pen * 260;
  const skill = 1 + marketingPower(s) * 0.035;
  return base / skill;
}

export function weeklyChurnRate(s: GameState): number {
  let r = 0.018 + (s.product.techDebt / 100) * 0.05;
  r -= Math.min(0.008, designPower(s) * 0.0006);
  for (const m of s.modifiers) if (m.kind === "churn") r += m.magnitude;
  return Math.max(0.004, r);
}

export function organicMult(s: GameState): number {
  let m = 1;
  for (const mod of s.modifiers) {
    if (mod.kind === "organic" || mod.kind === "press") m *= mod.magnitude;
  }
  return m;
}

export function weeklySalaries(s: GameState): number {
  return s.team.reduce((sum, e) => sum + (e.isFounder ? 0 : e.salary), 0) / 52;
}

export function weeklyOverhead(s: GameState): number {
  const office = 250 + s.team.length * 160 + s.perks * s.team.length * 55;
  const infra = s.users * idea(s).infraCostPerUser;
  return office + infra;
}

export function weeklyRevenue(s: GameState): number {
  return mrr(s) / 4.33;
}

export function weeklyBurn(s: GameState): number {
  return weeklySalaries(s) + weeklyOverhead(s) + s.marketingBudget;
}

export function weeklyNet(s: GameState): number {
  return weeklyRevenue(s) - weeklyBurn(s);
}

/** Runway in weeks; Infinity when profitable. */
export function runwayWeeks(s: GameState): number {
  const net = weeklyNet(s);
  if (net >= 0) return Infinity;
  return Math.max(0, Math.floor(s.cash / -net));
}

/** 4-week average weekly user growth rate. */
export function growthRate(s: GameState): number {
  const h = s.history;
  if (h.length < 5) return 0;
  const now = h[h.length - 1].users;
  const then = h[h.length - 5].users;
  if (then <= 0) return 0;
  return (now / then) ** (1 / 4) - 1;
}

export function valuation(s: GameState): number {
  const arr = mrr(s) * 12;
  const g = growthRate(s);
  const multiple = Math.min(28, 7 + Math.max(0, g) * 220);
  const v = arr * multiple + s.users * 14 + appeal(s) * 2_000;
  return Math.max(400_000, Math.round(v / 10_000) * 10_000);
}

export interface RoundDef {
  id: string;
  name: string;
  targetPct: number; // equity sold
  unlocked: (s: GameState) => boolean;
  requirement: string;
}

export const ROUNDS: RoundDef[] = [
  {
    id: "preseed",
    name: "Pre-seed",
    targetPct: 0.1,
    unlocked: () => true,
    requirement: "Always available"
  },
  {
    id: "seed",
    name: "Seed",
    targetPct: 0.15,
    unlocked: (s) => s.product.launched && s.users >= 2_000,
    requirement: "Launched, 2,000+ users"
  },
  {
    id: "a",
    name: "Series A",
    targetPct: 0.18,
    unlocked: (s) => mrr(s) >= 60_000,
    requirement: "$60k+ MRR"
  },
  {
    id: "b",
    name: "Series B",
    targetPct: 0.15,
    unlocked: (s) => mrr(s) >= 300_000,
    requirement: "$300k+ MRR"
  }
];

export function roundTaken(s: GameState, id: string): boolean {
  return s.investors.some((i) => i.round === id);
}

/** Pre-seed is priced on promise, later rounds on metrics. */
export function roundValuation(s: GameState, id: string): number {
  if (id === "preseed") return 1_500_000;
  return valuation(s);
}

export function log(s: GameState, msg: string, kind: "info" | "good" | "bad" | "money" = "info"): void {
  s.log.unshift({ week: s.week, msg, kind });
  if (s.log.length > 120) s.log.length = 120;
}

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function fmtWeek(week: number): string {
  return `Y${Math.floor(week / 52) + 1} · W${(week % 52) + 1}`;
}

function tickModifiers(s: GameState): void {
  const keep: Modifier[] = [];
  for (const m of s.modifiers) {
    m.weeksLeft -= 1;
    if (m.weeksLeft > 0) keep.push(m);
  }
  s.modifiers = keep;
}

function tickProduct(s: GameState): void {
  const pts = devPoints(s);
  const f = s.product.focus;
  s.product.progress += pts * f;
  const debtGain = pts * f * 0.24 * (s.crunch ? 1.5 : 1);
  const debtPaid = pts * (1 - f) * 0.55;
  s.product.techDebt = Math.min(100, Math.max(0, s.product.techDebt + debtGain - debtPaid));
}

function tickGrowth(s: GameState): void {
  if (!s.product.launched) return;
  const id = idea(s);
  const pen = Math.min(1, s.users / id.marketSize);

  const fromMarketing = s.marketingBudget > 0 ? s.marketingBudget / cac(s) : 0;
  const organic = s.users * id.virality * (appeal(s) / 100) * organicMult(s) * (1 - pen);
  const churned = s.users * weeklyChurnRate(s);

  s.users = Math.max(0, s.users + fromMarketing + organic - churned);

  const convBoost = 1 + salesPower(s) * 0.012;
  s.payingUsers = Math.min(s.users, s.users * id.conv * convBoost);
}

function tickFinance(s: GameState): void {
  s.cash += weeklyNet(s);
}

function tickMorale(s: GameState): void {
  for (const e of s.team) {
    let drift = (68 - e.morale) * 0.06; // pull toward baseline
    drift += s.perks * 1.1;
    if (s.crunch) drift -= 4.5;
    if (s.cash < 0) drift -= 3;
    e.morale = Math.min(100, Math.max(0, e.morale + drift));
  }
  // Burned-out employees may quit
  const quitters = s.team.filter((e) => !e.isFounder && e.morale < 22 && rand() < 0.16);
  for (const q of quitters) {
    s.team = s.team.filter((e) => e.id !== q.id);
    log(s, `${q.name} burned out and quit.`, "bad");
  }
}

function checkGameOver(s: GameState): void {
  if (s.cash < 0) {
    s.insolventWeeks += 1;
    if (s.insolventWeeks === 1) {
      log(s, "You can't make payroll. Fix the finances within 4 weeks or it's over.", "bad");
    }
    if (s.insolventWeeks > 4) {
      s.gameOver = {
        type: "bankrupt",
        title: "Bankrupt",
        body: `${s.companyName} ran out of money after ${fmtWeek(s.week)}. The servers went dark and the team moved on.`,
        payout: 0
      };
    }
  } else {
    s.insolventWeeks = 0;
  }
}

export function tick(s: GameState): void {
  if (s.gameOver || s.pendingEvent) return;
  s.week += 1;
  tickModifiers(s);
  tickProduct(s);
  tickGrowth(s);
  tickFinance(s);
  tickMorale(s);
  s.history.push({ week: s.week, cash: Math.round(s.cash), users: Math.round(s.users), mrr: Math.round(mrr(s)) });
  if (s.history.length > 520) s.history.shift();
  maybeSpawnEvent(s);
  checkGameOver(s);
}
