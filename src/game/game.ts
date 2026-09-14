import { ARCHETYPES, IDEAS, randomName, salaryAsk } from "./data";
import {
  fmtMoney, log, rand, roundTaken, ROUNDS, roundValuation, valuation, mrr
} from "./engine";
import type { Candidate, GameState, Role } from "./types";

const SAVE_KEY = "founder-save-v1";

// Weeks between funding rounds. Was 26 (6 months) — that locked a founder who
// took Pre-seed at week 0 out of Seed until week 26, right through the fragile
// post-launch burn window where the follow-on cash is needed most.
export const RAISE_COOLDOWN_WEEKS = 16;

const ROLES: Role[] = ["engineer", "designer", "marketer", "sales"];

function makeCandidates(s: GameState): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < 4; i++) {
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const skill = 1 + Math.floor(rand() * 9);
    out.push({
      id: s.nextId++,
      name: randomName(rand),
      role,
      skill,
      salary: salaryAsk(role, skill, rand)
    });
  }
  return out;
}

export function newGame(companyName: string, ideaId: string, archetypeId: string): GameState {
  const arch = ARCHETYPES.find((a) => a.id === archetypeId) ?? ARCHETYPES[0];
  const s: GameState = {
    companyName: companyName.trim() || IDEAS.find((i) => i.id === ideaId)?.name || "Untitled Inc",
    ideaId,
    week: 0,
    cash: 30_000,
    founderEquity: 1,
    investors: [],
    product: { progress: 0, techDebt: 0, launched: false, version: 0, focus: 0.75 },
    users: 0,
    payingUsers: 0,
    marketingBudget: 0,
    team: [],
    candidates: [],
    candidatesRefreshWeek: 0,
    crunch: false,
    perks: 0,
    modifiers: [],
    history: [{ week: 0, cash: 30_000, users: 0, mrr: 0 }],
    log: [],
    pendingEvent: null,
    insolventWeeks: 0,
    lastRaiseWeek: -999,
    gameOver: null,
    nextId: 1
  };
  s.team.push({
    id: s.nextId++,
    name: "You",
    role: arch.role,
    skill: arch.skill,
    salary: 0,
    morale: 85,
    isFounder: true,
    hiredWeek: 0
  });
  s.candidates = makeCandidates(s);
  log(s, `${s.companyName} is founded with $30k of savings. Build something people want.`, "good");
  return s;
}

export function refreshCandidates(s: GameState, paid: boolean): void {
  if (paid) {
    if (s.cash < 1_000) return;
    s.cash -= 1_000;
    log(s, "A recruiter sourced a fresh batch of candidates for $1k.", "money");
  }
  s.candidates = makeCandidates(s);
  s.candidatesRefreshWeek = s.week;
}

export function maybeAutoRefreshCandidates(s: GameState): void {
  if (s.week - s.candidatesRefreshWeek >= 6) {
    s.candidates = makeCandidates(s);
    s.candidatesRefreshWeek = s.week;
  }
}

export function hire(s: GameState, candidateId: number): void {
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c) return;
  s.candidates = s.candidates.filter((x) => x.id !== candidateId);
  s.team.push({
    id: c.id,
    name: c.name,
    role: c.role,
    skill: c.skill,
    salary: c.salary,
    morale: 75,
    isFounder: false,
    hiredWeek: s.week
  });
  log(s, `Hired ${c.name} — ${c.role}, skill ${c.skill}, ${fmtMoney(c.salary)}/yr.`, "good");
}

export function fire(s: GameState, employeeId: number): void {
  const e = s.team.find((x) => x.id === employeeId);
  if (!e || e.isFounder) return;
  const severance = Math.round(e.salary / 12);
  s.cash -= severance;
  s.team = s.team.filter((x) => x.id !== employeeId);
  for (const t of s.team) t.morale = Math.max(0, t.morale - 6);
  log(s, `Let ${e.name} go with ${fmtMoney(severance)} severance. The office is quieter.`, "bad");
}

export function launchProduct(s: GameState): void {
  if (s.product.launched) return;
  s.product.launched = true;
  s.product.version = 1;
  s.users = 150 + Math.round(rand() * 200);
  log(s, `${s.companyName} v1.0 is live! The first ${Math.round(s.users)} curious users show up.`, "good");
}

export function setFocus(s: GameState, f: number): void {
  s.product.focus = Math.min(1, Math.max(0, f));
}

export function setMarketing(s: GameState, budget: number): void {
  s.marketingBudget = Math.max(0, Math.round(budget));
}

export function toggleCrunch(s: GameState): void {
  s.crunch = !s.crunch;
  log(s, s.crunch ? "Crunch mode: the team ships 45% faster, morale pays the bill." : "Crunch is over. Everyone exhales.", "info");
}

export function buyPerks(s: GameState): void {
  const cost = [8_000, 20_000, 45_000][s.perks];
  if (s.perks >= 3 || cost === undefined || s.cash < cost) return;
  s.cash -= cost;
  s.perks += 1;
  for (const e of s.team) e.morale = Math.min(100, e.morale + 8);
  log(s, `Office upgrade level ${s.perks} — morale rises, and so does the rent.`, "money");
}

export function raiseRound(s: GameState, roundId: string): void {
  const def = ROUNDS.find((r) => r.id === roundId);
  if (!def || roundTaken(s, roundId) || !def.unlocked(s)) return;
  if (s.week - s.lastRaiseWeek < RAISE_COOLDOWN_WEEKS && s.investors.length > 0) return;
  const val = roundValuation(s, roundId);
  const amount = Math.round((val * def.targetPct) / 10_000) * 10_000;
  const equity = def.targetPct;
  // dilute everyone
  s.founderEquity *= 1 - equity;
  for (const inv of s.investors) inv.equityPct *= 1 - equity;
  s.investors.push({ round: roundId, amount, equityPct: equity, valuation: val, week: s.week });
  s.cash += amount;
  s.lastRaiseWeek = s.week;
  log(
    s,
    `${def.name} closed: ${fmtMoney(amount)} at ${fmtMoney(val)} post-money. You now own ${(s.founderEquity * 100).toFixed(1)}%.`,
    "money"
  );
}

export function fileIPO(s: GameState): void {
  if (!(valuation(s) >= 100_000_000 && mrr(s) >= 400_000)) return;
  const v = valuation(s);
  s.gameOver = {
    type: "ipo",
    title: "You rang the bell",
    body: `${s.companyName} went public at a ${fmtMoney(v)} valuation. Your stake is worth ${fmtMoney(v * s.founderEquity)}. From $30k of savings to the trading floor in ${Math.floor(s.week / 52)} year(s).`,
    payout: v * s.founderEquity
  };
}

export function save(s: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}

export function load(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    // event closures don't survive serialization
    s.pendingEvent = null;
    return s;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
