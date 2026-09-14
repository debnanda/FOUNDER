import "./styles.css";
import { log, tick } from "./game/engine";
import {
  buyPerks, clearSave, fileIPO, fire, hire, launchProduct, load,
  maybeAutoRefreshCandidates, newGame, raiseRound, refreshCandidates,
  save, setFocus, setMarketing, toggleCrunch
} from "./game/game";
import type { GameState } from "./game/types";
import { renderGame, renderGameOver, renderHowTo, renderSetup, type Actions, type Tab, type UIState } from "./ui/render";

const root = document.getElementById("app")!;

let state: GameState | null = load();
const ui: UIState = {
  tab: "dashboard",
  speed: 1,
  setup: { ideaId: "devtools", archetypeId: "hacker", name: "" },
  howTo: false
};

const TICK_MS = 1600;
let timer: number | null = null;
let lastSaveWeek = -1;

function render(): void {
  if (!state) {
    if (ui.howTo) renderHowTo(root, actions);
    else renderSetup(root, ui, actions);
  } else if (state.gameOver) {
    renderGameOver(root, state, actions);
  } else {
    renderGame(root, state, ui, actions);
  }
}

function step(): void {
  if (!state || state.gameOver || state.pendingEvent) return;
  tick(state);
  maybeAutoRefreshCandidates(state);
  if (state.week - lastSaveWeek >= 4) {
    save(state);
    lastSaveWeek = state.week;
  }
  render();
}

function reschedule(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
  if (ui.speed > 0) {
    timer = window.setInterval(step, TICK_MS / ui.speed);
  }
}

const actions: Actions = {
  newGame() {
    state = newGame(ui.setup.name, ui.setup.ideaId, ui.setup.archetypeId);
    ui.tab = "dashboard";
    ui.speed = 1;
    save(state);
    reschedule();
    render();
  },
  showHowTo() { ui.howTo = true; render(); },
  hideHowTo() { ui.howTo = false; render(); },
  setTab(t: Tab) { ui.tab = t; render(); },
  setSpeed(x: number) { ui.speed = x; reschedule(); render(); },
  launch() { if (state) { launchProduct(state); save(state); render(); } },
  setFocus(f: number) { if (state) setFocus(state, f); },
  setMarketing(b: number) { if (state) setMarketing(state, b); },
  toggleCrunch() { if (state) { toggleCrunch(state); render(); } },
  buyPerks() { if (state) { buyPerks(state); render(); } },
  hire(id: number) { if (state) { hire(state, id); save(state); render(); } },
  fire(id: number) { if (state) { fire(state, id); save(state); render(); } },
  rerollCandidates() { if (state) { refreshCandidates(state, true); render(); } },
  raise(roundId: string) { if (state) { raiseRound(state, roundId); save(state); render(); } },
  fileIPO() { if (state) { fileIPO(state); save(state); render(); } },
  chooseEvent(i: number) {
    if (!state?.pendingEvent) return;
    const choice = state.pendingEvent.choices[i];
    if (!choice) return;
    state.pendingEvent = null;
    const msg = choice.apply(state);
    log(state, msg, "info");
    save(state);
    render();
  },
  restart() {
    clearSave();
    state = null;
    ui.speed = 1;
    reschedule();
    render();
  }
};

document.addEventListener("keydown", (e) => {
  if (!state || state.gameOver) return;
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
  if (e.code === "Space") {
    e.preventDefault();
    actions.setSpeed(ui.speed === 0 ? 1 : 0);
  } else if (e.key === "1") actions.setSpeed(1);
  else if (e.key === "2") actions.setSpeed(2);
  else if (e.key === "3") actions.setSpeed(4);
});

reschedule();
render();
