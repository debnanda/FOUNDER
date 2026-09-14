/**
 * Headless playthroughs used to sanity-check game balance.
 * Run: npx tsx scripts/sim.ts
 *
 * Runs the same "sane founder" strategy across many seeded RNGs so results are
 * reproducible, then reports aggregate outcomes. A single run is inherently
 * noisy (event rolls, candidate pools, viral bursts) — the pass/fail bar here
 * is on the distribution, not any one playthrough.
 */
import { fmtMoney, fmtNum, mrr, setRand, tick, valuation, idea } from "../src/game/engine";
import { hire, launchProduct, newGame, raiseRound, setFocus, setMarketing } from "../src/game/game";
import type { GameState } from "../src/game/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

// Mulberry32 — tiny deterministic PRNG so each seed reproduces exactly.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveEvents(s: GameState): void {
  if (!s.pendingEvent) return;
  // Play a sane founder: never sell, otherwise take the first choice.
  const idx = s.pendingEvent.title === "Acquisition offer" ? 1 : 0;
  const choice = s.pendingEvent.choices[idx];
  s.pendingEvent = null;
  choice.apply(s);
}

function playYearlyStrategy(s: GameState): void {
  // Hire any decent engineer/marketer we can afford while runway allows.
  for (const c of [...s.candidates]) {
    const affordable = s.cash > c.salary * 0.6;
    const want =
      (c.role === "engineer" && c.skill >= 5) ||
      (s.product.launched && c.skill >= 6);
    if (affordable && want && s.team.length < 14) hire(s, c.id);
  }
  // Raise whatever round is open.
  for (const r of ["preseed", "seed", "a", "b"]) raiseRound(s, r);
  // Marketing scales with cash once launched, but never past a runway-safe share of it.
  if (s.product.launched) {
    setMarketing(s, Math.min(30_000, Math.max(0, Math.floor(s.cash / 40))));
    // Manage debt like an attentive player: pay down early, resume features once healthy.
    if (s.product.techDebt > 30) setFocus(s, 0.35);
    else if (s.product.techDebt < 15) setFocus(s, 0.75);
  }
}

interface RunResult {
  seed: number;
  outcome: "ipo" | "acquired" | "bankrupt" | "timeout";
  week: number;
  launchedWeek: number;
  cash: number;
  users: number;
  mrr: number;
  valuation: number;
}

function runOne(seed: number, weeks: number, verbose: boolean): RunResult {
  setRand(mulberry32(seed));
  const s = newGame("SimCo", "saas", "hacker");
  let launchedWeek = -1;

  for (let w = 0; w < weeks; w++) {
    playYearlyStrategy(s);
    if (!s.product.launched && s.product.progress >= idea(s).mvpPoints) {
      launchProduct(s);
      launchedWeek = s.week;
    }
    tick(s);
    resolveEvents(s);
    if (s.gameOver) break;

    const bad =
      !Number.isFinite(s.cash) || !Number.isFinite(s.users) || !Number.isFinite(mrr(s)) ||
      s.users < 0 || s.payingUsers < 0 || s.product.techDebt < 0 || s.product.techDebt > 100;
    assert(!bad, `seed ${seed}: state went invalid at week ${s.week}: cash=${s.cash} users=${s.users}`);
    if (bad) break;

    if (verbose && w % 52 === 0) {
      console.log(
        `Y${Math.floor(w / 52) + 1}: cash=${fmtMoney(s.cash)} users=${fmtNum(s.users)} ` +
        `mrr=${fmtMoney(mrr(s))} team=${s.team.length} debt=${Math.round(s.product.techDebt)} ` +
        `val=${fmtMoney(valuation(s))} equity=${(s.founderEquity * 100).toFixed(1)}%`
      );
    }
  }

  assert(launchedWeek > 0 && launchedWeek < 120, `seed ${seed}: MVP should launch within ~2 years (launched week ${launchedWeek})`);

  const outcome = s.gameOver ? s.gameOver.type : "timeout";
  return {
    seed,
    outcome,
    week: s.week,
    launchedWeek,
    cash: s.cash,
    users: s.users,
    mrr: mrr(s),
    valuation: valuation(s)
  };
}

const N = 30;
const WEEKS = 312; // 6 years
const results: RunResult[] = [];
for (let seed = 1; seed <= N; seed++) results.push(runOne(seed, WEEKS, seed === 1));

console.log("---");
console.log(`${N} seeded 6-year runs of the "sane founder" strategy:`);
for (const r of results) {
  console.log(
    `  seed ${String(r.seed).padStart(2)}: ${r.outcome.padEnd(8)} wk${String(r.week).padStart(4)} ` +
    `launch@${String(r.launchedWeek).padStart(3)} cash=${fmtMoney(r.cash).padStart(9)} ` +
    `users=${fmtNum(r.users).padStart(7)} mrr=${fmtMoney(r.mrr).padStart(8)} val=${fmtMoney(r.valuation).padStart(8)}`
  );
}

const bankrupt = results.filter((r) => r.outcome === "bankrupt");
const early = bankrupt.filter((r) => r.week < 104); // failed inside 2 years
const success = results.filter((r) => r.outcome === "ipo" || r.outcome === "acquired" || (r.outcome === "timeout" && r.mrr > 20_000));

console.log("---");
console.log(
  `bankrupt: ${bankrupt.length}/${N} (${early.length} within 2 years) · ` +
  `reached solid traction or exited: ${success.length}/${N}`
);

// Balance bar: a reasonably attentive strategy shouldn't fail most of the time,
// and shouldn't collapse in the first two years more than rarely.
assert(bankrupt.length / N <= 0.4, `bankruptcy rate too high for a sane strategy: ${bankrupt.length}/${N}`);
assert(early.length / N <= 0.15, `too many early (<2yr) bankruptcies: ${early.length}/${N}`);
assert(success.length / N >= 0.4, `too few runs reach solid traction: ${success.length}/${N}`);

console.log(process.exitCode ? "SIM FAILED" : "SIM OK");
