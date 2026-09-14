import type { Archetype, Idea, Role } from "./types";

export const IDEAS: Idea[] = [
  {
    id: "devtools",
    name: "ShipFast",
    tagline: "Deployment platform for indie developers",
    arpu: 38,
    marketSize: 2_500_000,
    virality: 0.014,
    conv: 0.055,
    infraCostPerUser: 0.012,
    mvpPoints: 260
  },
  {
    id: "saas",
    name: "ClientLoop",
    tagline: "CRM built for small service businesses",
    arpu: 26,
    marketSize: 12_000_000,
    virality: 0.009,
    conv: 0.07,
    infraCostPerUser: 0.006,
    mvpPoints: 220
  },
  {
    id: "social",
    name: "Campfire",
    tagline: "Community platform for creators and their fans",
    arpu: 11,
    marketSize: 400_000_000,
    virality: 0.032,
    conv: 0.05,
    infraCostPerUser: 0.004,
    mvpPoints: 260
  },
  {
    id: "fintech",
    name: "Brightledger",
    tagline: "Automated bookkeeping for freelancers",
    arpu: 23,
    marketSize: 45_000_000,
    virality: 0.011,
    conv: 0.065,
    infraCostPerUser: 0.008,
    mvpPoints: 290
  },
  {
    id: "ai",
    name: "Muse",
    tagline: "AI research copilot for knowledge workers",
    arpu: 29,
    marketSize: 120_000_000,
    virality: 0.022,
    conv: 0.04,
    infraCostPerUser: 0.01,
    mvpPoints: 280
  }
];

export const ARCHETYPES: Archetype[] = [
  {
    id: "hacker",
    name: "The Hacker",
    blurb: "You ship code faster than anyone. Starts as a skill-8 engineer.",
    role: "engineer",
    skill: 8
  },
  {
    id: "hustler",
    name: "The Hustler",
    blurb: "You can sell anything. Starts as a skill-8 marketer.",
    role: "marketer",
    skill: 8
  },
  {
    id: "craftsman",
    name: "The Craftsman",
    blurb: "Taste is your edge. Starts as a skill-8 designer.",
    role: "designer",
    skill: 8
  }
];

export const ROLE_LABEL: Record<Role, string> = {
  engineer: "Engineer",
  designer: "Designer",
  marketer: "Marketer",
  sales: "Sales"
};

export const ROLE_DESC: Record<Role, string> = {
  engineer: "Builds product. More engineers, faster feature and stability work.",
  designer: "Polishes product. Boosts appeal and cuts churn.",
  marketer: "Stretches every marketing dollar further.",
  sales: "Converts more users into paying customers."
};

const FIRST = [
  "Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Ines", "Kai", "Priya", "Dev",
  "Sana", "Omar", "Lena", "Hugo", "Nina", "Felix", "Tara", "Ivan", "June", "Marco",
  "Aisha", "Ray", "Elif", "Jonas", "Ruth", "Andrei", "Wei", "Carla", "Tomas", "Yuki"
];
const LAST = [
  "Chen", "Okafor", "Silva", "Novak", "Haddad", "Kim", "Rossi", "Iyer", "Berg", "Diaz",
  "Kowalski", "Tanaka", "Moreau", "Ali", "Johansson", "Costa", "Petrov", "Nakamura", "Weber", "Roy"
];

export function randomName(rand: () => number): string {
  return `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
}

// Yearly salary a candidate asks for, by role and skill.
export function salaryAsk(role: Role, skill: number, rand: () => number): number {
  const mult: Record<Role, number> = { engineer: 1.15, designer: 1.0, marketer: 0.95, sales: 0.9 };
  const base = (30_000 + skill * 7_500) * mult[role];
  return Math.round((base * (0.92 + rand() * 0.16)) / 500) * 500;
}
