import type { Game } from '../game';

/** The current main-story step, written as an instruction for the tracker. */
export function mainObjective(game: Game): string {
  const has = (flag: Parameters<Game['hasFlag']>[0]): boolean => game.hasFlag(flag);
  const p = game.progress;
  const mining = p.level('mining');

  if (!has('license_granted')) {
    if (!has('met_iona')) return 'Ask Iona at the Survey Office about a delver’s license';
    const copper = p.count('copper_ore');
    return copper >= 5 ? 'Bring five copper ore to Iona' : `License test: mine copper ore in the Entry Yard (${copper}/5)`;
  }
  if (!has('iron_pick_forged')) {
    if (mining < 10) return `Train Mining to 10 on copper seams (now ${mining})`;
    const iron = p.count('iron_ore');
    return iron >= 8 ? 'Take your iron ore to Oren and forge an iron pickaxe' : `Mine iron in the yard’s east alcove (${iron}/8)`;
  }
  if (!has('cracked_wall_broken')) {
    return mining < 12 ? `Reach Mining 12 to break the cracked wall (now ${mining})` : 'Break the cracked wall in the Entry Yard';
  }
  if (!has('schematic_delivered')) return 'Bring the storeroom schematic to Iona';
  if (!has('irregular_seen')) return 'Explore the Broken Galleries, south of the yard';
  if (!has('galleries_route_open')) return 'Find a way past the collapse in the Broken Galleries';
  if (!has('met_tavi')) return 'Find the delver Tavi at Lantern Pool';
  if (!has('rod_received')) return 'Ask Pell, back in Bellwether, about fishing Lantern Pool';
  if (!has('lower_cut_reached')) return 'Follow the water down to the Lower Cut';
  if (!(has('pump_power_restored') && has('pump_intake_cleared') && has('pump_sequence_known'))) {
    const done = [has('pump_power_restored'), has('pump_intake_cleared'), has('pump_sequence_known')].filter(Boolean).length;
    if (has('pump_plate_found') && !has('pump_sequence_known')) return 'Take the control plate to Iona for translation';
    return `Repair the Pump Station (${done}/3)`;
  }
  if (!has('sluicekeeper_defeated')) return 'Engage the main controls in the Pump Station';
  if (!has('rank_two')) return 'Report to Iona at the Survey Office';
  if (!has('deep_lift_ceremony')) return 'Meet Mara at the main lift';
  return 'The deep lift is running. The Rootvault waits below.';
}
