import type { GameState, PendingEvent } from "./types";
import {
  appeal, fmtMoney, fmtNum, idea, log, mrr, rand, salesPower, stability, valuation
} from "./engine";

interface EventDef {
  weight: (s: GameState) => number;
  build: (s: GameState) => PendingEvent | null;
}

function pressEvent(s: GameState): PendingEvent {
  return {
    title: "Press wants the story",
    body: "A well-known tech publication wants to profile your company. A good story doubles word of mouth for a month — but a demo that falls over live would sting.",
    choices: [
      {
        label: "Do the interview",
        detail: stability(s) < 55 ? "Risky — the product is shaky right now" : "The product can handle the attention",
        apply: (st) => {
          if (stability(st) < 55 && rand() < 0.45) {
            st.modifiers.push({ kind: "churn", weeksLeft: 4, magnitude: 0.012 });
            return "The live demo crashed. The article ran with the headline “Promising but unfinished.” Churn is up for a month.";
          }
          st.modifiers.push({ kind: "press", weeksLeft: 4, magnitude: 2.2 });
          return "The profile ran and it's glowing. Organic growth doubled for 4 weeks.";
        }
      },
      {
        label: "Pass quietly",
        detail: "No risk, no reward",
        apply: () => "You passed on the press. Heads down."
      }
    ]
  };
}

function viralEvent(s: GameState): PendingEvent {
  const burst = Math.max(300, Math.round(s.users * 0.25));
  return {
    title: "You're going viral",
    body: `A post about ${s.companyName} is blowing up. Roughly ${fmtNum(burst)} new users are signing up. Pour ad money on the fire, or let it ride?`,
    choices: [
      {
        label: `Amplify with $8k of ads`,
        detail: "Triples the burst, costs cash now",
        apply: (st) => {
          st.cash -= 8_000;
          st.users += burst * 3;
          return `You amplified the moment: ${fmtNum(burst * 3)} users joined. It cost $8k well spent.`;
        }
      },
      {
        label: "Let it ride",
        detail: "Free users, no spend",
        apply: (st) => {
          st.users += burst;
          return `${fmtNum(burst)} users rode the wave in. Not bad for a Tuesday.`;
        }
      }
    ]
  };
}

function outageEvent(s: GameState): PendingEvent {
  const lost = Math.round(s.users * 0.06);
  return {
    title: "Major outage",
    body: `Tech debt caught up with you — the service has been down for hours and ${fmtNum(lost)} users are walking. How do you respond?`,
    choices: [
      {
        label: "All-hands emergency fix",
        detail: "Team morale takes a hit, but you pay down real debt",
        apply: (st) => {
          st.users = Math.max(0, st.users - lost * 0.5);
          st.product.techDebt = Math.max(0, st.product.techDebt - 18);
          for (const e of st.team) e.morale = Math.max(0, e.morale - 9);
          return "A brutal week of firefighting. You lost fewer users and fixed the root cause.";
        }
      },
      {
        label: "Patch it and apologize",
        detail: "Cheaper, but the debt remains",
        apply: (st) => {
          st.users = Math.max(0, st.users - lost);
          st.modifiers.push({ kind: "churn", weeksLeft: 3, magnitude: 0.01 });
          return `You patched around it. ${fmtNum(lost)} users left and trust is dented for a few weeks.`;
        }
      }
    ]
  };
}

function competitorEvent(): PendingEvent {
  return {
    title: "A funded competitor launches",
    body: "A well-capitalized competitor just launched a near-clone with a splashy campaign. Expect elevated churn for the next two months.",
    choices: [
      {
        label: "Grit your teeth",
        detail: "Ride it out",
        apply: (st) => {
          st.modifiers.push({ kind: "churn", weeksLeft: 8, magnitude: 0.011 });
          return "The clone is live. Churn will run hot for 8 weeks — ship your way out of it.";
        }
      },
      {
        label: "Counter-campaign ($12k)",
        detail: "Blunt the damage with a marketing push",
        apply: (st) => {
          st.cash -= 12_000;
          st.modifiers.push({ kind: "churn", weeksLeft: 8, magnitude: 0.004 });
          st.modifiers.push({ kind: "organic", weeksLeft: 4, magnitude: 1.4 });
          return "Your counter-campaign landed. The competitor still hurts, but far less.";
        }
      }
    ]
  };
}

function poachEvent(s: GameState): PendingEvent | null {
  const targets = s.team.filter((e) => !e.isFounder && e.skill >= 6);
  if (targets.length === 0) return null;
  const t = targets[Math.floor(rand() * targets.length)];
  const bump = Math.round((t.salary * 0.2) / 500) * 500;
  return {
    title: `${t.name} got an offer`,
    body: `A big tech company is trying to poach ${t.name} (${t.role}, skill ${t.skill}) with a fat package. Match the energy or let them go?`,
    choices: [
      {
        label: `Counter with +${fmtMoney(bump)}/yr`,
        detail: "Keep them, permanently higher payroll",
        apply: (st) => {
          const e = st.team.find((x) => x.id === t.id);
          if (e) {
            e.salary += bump;
            e.morale = Math.min(100, e.morale + 15);
          }
          return `${t.name} stayed — flattered, better paid, and fired up.`;
        }
      },
      {
        label: "Wish them well",
        detail: "Lose them, save the payroll",
        apply: (st) => {
          st.team = st.team.filter((x) => x.id !== t.id);
          return `${t.name} left for the big co. The team threw a bittersweet send-off.`;
        }
      }
    ]
  };
}

function acquisitionEvent(s: GameState): PendingEvent {
  const offer = Math.round((valuation(s) * (0.85 + rand() * 0.55)) / 100_000) * 100_000;
  return {
    title: "Acquisition offer",
    body: `A strategic acquirer is offering ${fmtMoney(offer)} in cash for ${s.companyName}. Your share would be ${fmtMoney(offer * s.founderEquity)}. This offer expires if you decline.`,
    choices: [
      {
        label: `Sell for ${fmtMoney(offer)}`,
        detail: `You personally take home ${fmtMoney(offer * s.founderEquity)}`,
        apply: (st) => {
          st.gameOver = {
            type: "acquired",
            title: "Acquired",
            body: `You sold ${st.companyName} for ${fmtMoney(offer)}. After ${Math.floor(st.week / 52)} year(s) and ${st.week % 52} weeks, you walk away with ${fmtMoney(offer * st.founderEquity)}.`,
            payout: offer * st.founderEquity
          };
          return "Deal signed.";
        }
      },
      {
        label: "We're not done building",
        detail: "Decline and keep going",
        apply: () => "You turned down the money. The story isn't finished."
      }
    ]
  };
}

function enterpriseEvent(s: GameState): PendingEvent {
  const deal = Math.max(2_000, Math.round(mrr(s) * 0.15));
  return {
    title: "Enterprise lead",
    body: `A large customer wants a custom contract worth ${fmtMoney(deal)}/mo, but demands two weeks of dedicated engineering for compliance features.`,
    choices: [
      {
        label: "Take the deal",
        detail: "Recurring revenue, slows the roadmap",
        apply: (st) => {
          // payingUsers is recomputed from st.users every tick, so a direct bump here
          // would evaporate on the next tick. Add real users sized so the resulting
          // paying-customer count actually delivers the promised MRR, and it sticks.
          const id2 = idea(st);
          const convBoost = 1 + salesPower(st) * 0.012;
          const addedPaying = deal / id2.arpu;
          const addedUsers = addedPaying / (id2.conv * convBoost);
          st.users += addedUsers;
          st.product.progress = Math.max(0, st.product.progress - 25);
          return `Contract signed: +${fmtMoney(deal)}/mo. The roadmap slips a little.`;
        }
      },
      {
        label: "Stay focused",
        detail: "Decline, protect the roadmap",
        apply: () => "You declined the custom work. The roadmap thanks you."
      }
    ]
  };
}

const EVENTS: EventDef[] = [
  { weight: (s) => (s.product.launched && s.users > 500 ? 1 : 0), build: pressEvent },
  { weight: (s) => (s.product.launched && s.users > 200 ? 1.1 : 0), build: viralEvent },
  {
    weight: (s) => (s.product.launched && s.users > 300 ? 0.4 + (s.product.techDebt / 100) * 2.2 : 0),
    build: outageEvent
  },
  { weight: (s) => (s.product.launched && s.users > 1_000 ? 0.9 : 0), build: competitorEvent },
  { weight: (s) => (s.team.length > 2 ? 0.8 : 0), build: poachEvent },
  { weight: (s) => (mrr(s) > 20_000 ? 0.5 : 0), build: acquisitionEvent },
  { weight: (s) => (s.product.launched && mrr(s) > 4_000 && appeal(s) > 40 ? 0.7 : 0), build: enterpriseEvent }
];

export function maybeSpawnEvent(s: GameState): void {
  if (s.pendingEvent || s.gameOver) return;
  const p = s.product.launched ? 0.13 : 0.05;
  if (rand() > p) return;
  const pool = EVENTS.map((e) => ({ e, w: e.weight(s) })).filter((x) => x.w > 0);
  if (pool.length === 0) return;
  const total = pool.reduce((sum, x) => sum + x.w, 0);
  let r = rand() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) {
      const ev = x.e.build(s);
      if (ev) {
        s.pendingEvent = ev;
        log(s, `Event: ${ev.title}`, "info");
      }
      return;
    }
  }
}
