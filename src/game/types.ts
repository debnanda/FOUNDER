export type Role = "engineer" | "designer" | "marketer" | "sales";

export interface Idea {
  id: string;
  name: string;
  tagline: string;
  arpu: number; // monthly $ per paying user
  marketSize: number; // total addressable users
  virality: number; // weekly organic growth coefficient
  conv: number; // free -> paying conversion
  infraCostPerUser: number; // weekly $ per active user
  mvpPoints: number; // dev points needed to launch
}

export interface Archetype {
  id: string;
  name: string;
  blurb: string;
  role: Role;
  skill: number;
}

export interface Employee {
  id: number;
  name: string;
  role: Role;
  skill: number; // 1..10
  salary: number; // yearly $
  morale: number; // 0..100
  isFounder: boolean;
  hiredWeek: number;
}

export interface Candidate {
  id: number;
  name: string;
  role: Role;
  skill: number;
  salary: number;
}

export interface Investor {
  round: string;
  amount: number;
  equityPct: number; // 0..1
  valuation: number; // post-money
  week: number;
}

export interface Modifier {
  kind: "churn" | "organic" | "press";
  weeksLeft: number;
  magnitude: number;
}

export interface LogEntry {
  week: number;
  msg: string;
  kind: "info" | "good" | "bad" | "money";
}

export interface HistoryPoint {
  week: number;
  cash: number;
  users: number;
  mrr: number;
}

export interface EventChoice {
  label: string;
  detail: string;
  apply: (s: GameState) => string; // returns log message
}

export interface PendingEvent {
  title: string;
  body: string;
  choices: EventChoice[];
}

export interface GameOver {
  type: "bankrupt" | "acquired" | "ipo";
  title: string;
  body: string;
  payout: number;
}

export interface GameState {
  companyName: string;
  ideaId: string;
  week: number; // weeks since founding, 0-based
  cash: number;
  founderEquity: number; // 0..1
  investors: Investor[];
  product: {
    progress: number;
    techDebt: number; // 0..100
    launched: boolean;
    version: number;
    focus: number; // 0..1, share of dev effort on features (rest -> stability)
  };
  users: number;
  payingUsers: number;
  marketingBudget: number; // $/week
  team: Employee[];
  candidates: Candidate[];
  candidatesRefreshWeek: number;
  crunch: boolean;
  perks: number; // 0..3
  modifiers: Modifier[];
  history: HistoryPoint[];
  log: LogEntry[];
  pendingEvent: PendingEvent | null;
  insolventWeeks: number;
  lastRaiseWeek: number;
  gameOver: GameOver | null;
  nextId: number;
}
