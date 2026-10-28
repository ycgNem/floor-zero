import type { Game } from '../game';
import { NPCS, type NpcId } from '../town/npcs';
import { wait } from '../ui/dom';
import type { PanelSpec } from '../ui/panels';

/** Story moments: each changes the world and says something about it. */
export class Story {
  constructor(private readonly game: Game) {}

  private say(id: NpcId, text: string): void {
    this.game.panels.show((): PanelSpec => ({
      name: NPCS[id].name,
      role: NPCS[id].role,
      text,
      options: [{ label: 'Leave', onClick: () => this.game.panels.close() }],
    }));
  }

  grantLicense(): void {
    const g = this.game;
    if (g.progress.take('copper_ore', 5) < 5) return;
    g.setFlag('license_granted');
    g.state.player.licenseRank = 1;
    g.progress.addMoney(20);
    g.hud.announce('Delver’s license', 'Rank I · Novice Delver');
    this.say('iona', 'Clean ore, and you came back with all your fingers. Congratulations, delver. Your license is Rank I: the Old Works are yours to work.\n\nTwenty bells for the copper. Oren at the forge will want to see you once you’re pulling iron.');
  }

  deliverSchematic(): void {
    const g = this.game;
    if (g.progress.take('storeroom_schematic', 1) < 1) return;
    g.setFlag('schematic_delivered');
    g.progress.addMoney(60);
    g.hud.announce('Discovery', 'The boltcaster drawings');
    this.say('iona', 'These are builders’ drawings. Not a map: a manufacturing sheet. A spring-loaded launcher. A boltcaster.\n\nOren could build this if you bring him the parts. Sixty bells for the find, and I’ll want everything else you turn up down there.');
  }

  translatePlate(): void {
    const g = this.game;
    if (g.progress.take('control_plate', 1) < 1) return;
    g.setFlag('pump_sequence_known');
    g.hud.announce('Translation', 'The pump’s operating sequence');
    this.say('iona', 'It’s an operating sequence. Valve order, pressure, then the main drive. Whoever wrote this expected people to read it every day.\n\nI’ve copied it into your notes. Open the valves in that order and the station should accept the main controls. Should.');
  }

  /** Rank II, for either of the Old Works' Feats. */
  rankUp(feat: 'sluicekeeper' | 'hollowhorn'): void {
    const g = this.game;
    g.setFlag('rank_two');
    g.state.player.licenseRank = 2;
    g.state.player.health = g.progress.maxHealth();
    g.hud.announce('Feat recorded', 'Rank II · Delver');
    this.say('iona', feat === 'sluicekeeper'
      ? 'A maintenance automaton. Not a monster: a worker, doing its job after everyone it worked for was gone.\n\nThat’s a Feat, and I’m writing it down. Rank II. The deep lift is yours. Mara is waiting at the main lift.'
      : 'Something from far below, this high up, and you hunted it down in its own den. Whatever pushed it up here is still down there.\n\nThat’s a Feat, and I’m writing it down. Rank II. The pump still isn’t running, though, and until it is the deep lift stays where it is.');
  }

  receiveRod(): void {
    const g = this.game;
    g.state.player.equipment.rod = 'fishing_rod';
    g.progress.give('bait_grubs', 20);
    g.setFlag('rod_received');
    g.hud.announce('New tool', 'Fishing rod');
    this.say('pell', 'Take my old rod. It’s caught more fish than I have, which is a sad thing to say about yourself.\n\nGrubs on the hook, cast into the pool, wait for the float to dip, then pull. Bring me minnows and I’ll teach you what to do with them.');
  }

  taviDialogue(): PanelSpec {
    const g = this.game;
    const first = !g.hasFlag('met_tavi');
    g.setFlag('met_tavi');
    const close = { label: 'Leave', onClick: () => g.panels.close() };
    if (first) {
      return {
        name: NPCS.tavi.name,
        role: NPCS.tavi.role,
        text: 'You’re the new one. Tavi. I’ve been down here two years and you’re the first person to get past the galleries since spring.\n\nWas that you, with the thing in the galleries? Horns, big as a cart? It went straight past this pool. Didn’t even look at the fish.\n\nIf you’re staying, talk to Pell. Nobody fishes Lantern Pool anymore, and Pell takes that personally.',
        options: [close],
      };
    }
    return {
      name: NPCS.tavi.name,
      role: NPCS.tavi.role,
      text: !g.hasFlag('pool_ladder_secured')
        ? 'That old shaft off the west shore goes straight up to the Entry Yard. The bottom rungs rotted away years ago, but tie a rope on and you’d never have to walk the galleries again. Bram sells rope.'
        : !g.hasFlag('pool_walkway_repaired')
          ? 'Best fishing in the Old Works is out on that platform, and nobody’s stood on it in years. Six planks and a couple of iron brackets would fix the walkway. You’ve got a smith’s hands, haven’t you?'
          : g.hasFlag('lower_cut_reached')
            ? 'The water’s louder down past the Cut. Something’s pushing it. Pumps don’t run themselves. Or they shouldn’t.'
            : 'Follow the water down. Everything in this place goes downhill eventually.',
      options: [close],
    };
  }

  /** The end of chapter one: the deep lift descends for the first time in generations. */
  async deepLiftCeremony(): Promise<void> {
    const g = this.game;
    g.panels.close();
    g.player.frozen = true;
    await g.hud.fade(1, 1.2);
    g.setFlag('deep_lift_ceremony');
    g.state.evening = true;
    g.reloadArea();
    await wait(0.5);
    void g.hud.fade(0, 2);
    g.hud.showCaption('Chapter One', 'The Lift Descends', 6);
    g.events.emit('ceremony', {});
    await wait(9);
    g.hud.announce('The deep lift', 'Running for the first time in generations');
    await wait(3);
    g.player.frozen = false;
    g.save();
  }
}
