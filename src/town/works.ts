import { countOf } from '../data/items';
import { PROJECTS, type ProjectDef, type ProjectId } from '../data/projects';
import type { Game } from '../game';
import { deliverTo, emptyProject, owed, projectStage } from '../items/projects';
import { NPCS } from './npcs';
import type { PanelAction, PanelRow, PanelSpec } from '../ui/panels';

/** Projects posted on the board right now: unlocked by the story, in board order. */
export function postedProjects(game: Game): ProjectId[] {
  return (Object.keys(PROJECTS) as ProjectId[]).filter((id) => {
    const def: ProjectDef = PROJECTS[id];
    return !def.onSite && (!def.requires || game.hasFlag(def.requires));
  });
}

/** Hands in what you carry toward a project. On-site projects finish the moment they're complete. */
export function deliver(game: Game, id: ProjectId): void {
  const state = (game.state.projects[id] ??= emptyProject());
  const moved = deliverTo(PROJECTS[id], state, game.state.player.pack);
  if (moved.length === 0) {
    game.hud.toast('You aren’t carrying anything it still needs.', 'warn');
    return;
  }
  for (const { item, count } of moved) game.events.emit('itemRemoved', { item, count });
  game.events.emit('sound', { name: 'valve' });
  game.hud.toast(`Handed in ${moved.map(({ item, count }) => countOf(item, count)).join(', ')}.`, 'good');
  const def: ProjectDef = PROJECTS[id];
  if (def.onSite && owed(def, state).length === 0) {
    state.fundedOn = game.state.day;
    game.setFlag(def.flag);
  }
  game.save();
}

/** What a project still needs, for prompts and panels. */
export function owedText(game: Game, id: ProjectId): string {
  return owed(PROJECTS[id], game.state.projects[id]).map(([item, count]) => countOf(item, count)).join(', ');
}

function fund(game: Game, id: ProjectId): void {
  const def = PROJECTS[id];
  const state = (game.state.projects[id] ??= emptyProject());
  if (game.progress.money < def.cost) {
    game.hud.toast(`The crews want ${def.cost} bells before they start.`, 'warn');
    return;
  }
  game.progress.addMoney(-def.cost);
  state.fundedOn = game.state.day;
  game.hud.announce('Town Works', `${def.name}: building tonight`);
  game.save();
}

/** The Town Works board on the plaza: community projects you supply and fund (doc 06). */
export function worksBoard(game: Game): PanelSpec {
  const rows: PanelRow[] = [];
  for (const id of postedProjects(game)) {
    const def = PROJECTS[id];
    const state = game.state.projects[id];
    const stage = projectStage(def, state, game.hasFlag(def.flag));
    const actions: PanelAction[] = [];
    let meta: string;
    let detail: string;
    if (stage === 'built') {
      meta = 'Built';
      detail = def.gives;
    } else if (stage === 'funded') {
      meta = 'Building tonight';
      detail = def.gives;
    } else {
      const left = owed(def, state);
      const carrying = left.some(([item]) => game.progress.count(item) > 0);
      detail = `${NPCS[def.npc].name}: “${def.pitch}”\n${def.gives}`;
      if (stage === 'collecting') {
        meta = left.map(([item, count]) => countOf(item, count)).join(' · ');
        actions.push({ label: 'Hand in what I have', disabled: !carrying, onClick: () => deliver(game, id) });
      } else {
        meta = `${def.cost} bells to start`;
        actions.push({ label: `Fund it (${def.cost} bells)`, disabled: game.progress.money < def.cost, onClick: () => fund(game, id) });
      }
    }
    rows.push({ title: def.name, detail, meta, actions, dim: stage === 'built' });
  }
  if (rows.length === 0) rows.push({ title: 'Nothing posted yet. Get your license first.', dim: true });
  return {
    name: 'Town Works',
    role: 'Bellwether',
    text: 'Bring the materials, pay the crews, and it goes up overnight.',
    rows,
    options: [{ label: 'Done', onClick: () => game.panels.close() }],
    footer: `${game.progress.money} bells`,
  };
}
