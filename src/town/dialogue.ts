import { ITEMS } from '../data/items';
import type { Game } from '../game';
import type { PanelAction, PanelSpec } from '../ui/panels';
import { NPCS, type NpcId } from './npcs';

function leave(game: Game): PanelAction {
  return { label: 'Leave', onClick: () => game.panels.close() };
}

function spec(id: NpcId, text: string, options: (PanelAction | null)[]): PanelSpec {
  return { name: NPCS[id].name, role: NPCS[id].role, text, options: options.filter((o): o is PanelAction => o !== null) };
}

function rotating(game: Game, lines: string[]): string {
  return lines[game.state.day % lines.length] ?? lines[0] ?? '';
}

/** What each townsperson says right now, given the story so far. */
export function dialogueFor(game: Game, id: NpcId): PanelSpec {
  const has = (flag: Parameters<Game['hasFlag']>[0]): boolean => game.hasFlag(flag);
  const town = game.town;
  const p = game.progress;
  const job = town.jobOption(id);

  switch (id) {
    case 'mara': {
      const first = !has('met_mara');
      game.setFlag('met_mara');
      if (!has('license_granted')) {
        return spec(id, first
          ? 'New face. You’ll be the one Hollis let the room over the kitchen to.\n\nIf you’re here for the lift, you need a license, and Iona at the Survey Office runs the test. She’ll send you down to the yard for copper. I’ll take you that far.'
          : 'Iona’s test first. Five copper from the yard. The lift’s right here when you’re ready.', [
          { label: 'What’s down there?', onClick: () => game.panels.show(() => spec(id, 'The Old Works. Quarries, galleries, a lot of old machinery nobody understands.\n\nThe yard’s safe enough. Past it, mind yourself. I’ve hauled up enough people who didn’t.', [leave(game)])) },
          leave(game),
        ]);
      }
      if (has('sluicekeeper_defeated') && !has('deep_lift_ceremony')) {
        return spec(id, has('rank_two')
          ? 'Iona told me. Rank Two. And the station controls answering for the first time since before my grandmother.\n\nThe deep lift’s ready. Half the town’s coming to watch. You coming?'
          : 'Word travels fast. Go and see Iona first. She’ll want it on paper before I put anyone on that lift.', [
          has('rank_two') ? { label: 'Ride the deep lift', onClick: () => game.story.deepLiftCeremony() } : null,
          leave(game),
        ]);
      }
      return spec(id, rotating(game, [
        'Lift’s running. Bell goes when she drops. Don’t lean on the gate.',
        'Good haul? Hollis keeps your storage. Nothing’s yours until it’s upstairs.',
        has('irregular_seen') ? 'That thing in the galleries. I’ve worked this lift thirty years and never heard of anything like it that high up.' : 'The galleries have been noisy lately. Rockfalls, maybe. Maybe not.',
        'If you go down, I come and get you. That’s the arrangement. It’s not free.',
      ]), [leave(game)]);
    }

    case 'iona': {
      const first = !has('met_iona');
      game.setFlag('met_iona');
      const options: (PanelAction | null)[] = [];
      let text: string;
      if (!has('license_granted')) {
        const copper = p.count('copper_ore');
        text = first
          ? 'A new applicant. Good. We need people who can read a seam and still come back up.\n\nThe test is simple: take the lift to the Entry Yard, mine five copper ore, and bring it to me. Mara knows you’re coming.'
          : copper >= 5 ? 'Is that copper? Let’s see it.' : 'Five copper ore. The seams are along the yard walls. Look for the orange veins.';
        if (copper >= 5) {
          options.push({ label: 'Hand over five copper ore', onClick: () => game.story.grantLicense() });
        }
      } else if (p.count('storeroom_schematic') > 0) {
        text = 'You got through the wall? What did you find?';
        options.push({ label: 'Show her the storeroom schematic', onClick: () => game.story.deliverSchematic() });
      } else if (p.count('control_plate') > 0 && !has('pump_sequence_known')) {
        text = 'That’s builders’ brass. Where did you find it?';
        options.push({ label: 'Ask her to translate the control plate', onClick: () => game.story.translatePlate() });
      } else if ((has('sluicekeeper_defeated') || has('hollowhorn_slain')) && !has('rank_two')) {
        const keeper = has('sluicekeeper_defeated');
        text = keeper
          ? 'Every floor marker in the Old Works lit up at once. People saw it from the yard. Tell me everything.'
          : 'They say you went into its den. The horned thing from the galleries. And came back. Tell me everything.';
        options.push({ label: keeper ? 'Tell her about the Sluicekeeper' : 'Tell her about the Hollowhorn', onClick: () => game.story.rankUp(keeper ? 'sluicekeeper' : 'hollowhorn') });
      } else if (!has('cracked_wall_broken')) {
        text = 'Someone reported a cracked wall in the yard. Builders’ stone behind it, I’d bet. If you get a pick that can break it, I want to know what’s there.';
      } else if (!has('irregular_seen')) {
        text = 'The Broken Galleries run south of the yard. Mapped, mostly. Mostly is doing a lot of work in that sentence.';
      } else {
        text = rotating(game, [
          'Every core you bring up keeps a lamp burning somewhere in town. I pay fairly for them.',
          'The water levels in the Old Works are changing. Slowly, but they are. Nothing down there changes without a reason.',
          `Deepest floor on record: ${game.state.player.deepestFloor > 0 ? `${game.state.player.deepestFloor}, and it’s yours` : 'nobody can read the markers past zero'}.`,
        ]);
      }
      const hasCores = p.count('dim_core') + p.count('bright_core') + p.count('radiant_core') > 0;
      if (hasCores) {
        options.push({ label: 'Sell cores', onClick: () => game.panels.show(() => ({ name: 'Core exchange', role: 'Survey Office', rows: town.sellRows((item) => ITEMS[item].kind === 'core'), options: [{ label: 'Done', onClick: () => game.panels.show(() => dialogueFor(game, 'iona')) }], footer: `${p.money} bells` })) });
      }
      options.push(job, leave(game));
      return spec(id, text, options);
    }

    case 'oren': {
      const first = !has('met_oren');
      game.setFlag('met_oren');
      const text = first
        ? 'You’re the new delver. Good. Copper’s fine for nails and pans, but I need iron, and nobody brings me enough.\n\nGet your Mining up, bring me eight iron ore, and I’ll forge you a pick that can cut proper rock.'
        : has('schematic_delivered') && !game.state.player.equipment.boltcaster
          ? 'Iona showed me those drawings. A boltcaster. Six iron and two good springs, and I can build it. The old constructs are full of springs, if you can get one to hold still.'
          : 'Bring me ore and I’ll make you something worth carrying.';
      return spec(id, text, [{ label: 'Use the forge', onClick: () => game.panels.show(() => town.crafting('forge')) }, job, leave(game)]);
    }

    case 'pell': {
      const first = !has('met_pell');
      game.setFlag('met_pell');
      const fish = p.count('cave_minnow') + p.count('lantern_eel') + p.count('white_cavefish') > 0;
      const rodOffer = has('met_tavi') && !has('rod_received');
      const text = rodOffer
        ? 'Tavi says you’ve seen Lantern Pool. Then you’ve seen the fish. Nobody fishes it anymore, which is a crime against soup.'
        : first
          ? 'Ah! A delver. Have you eaten anything down there that looked back at you? No? Bring me some anyway.\n\nThe kitchen’s open to anyone who cooks. Fish, glowcaps, whatever you carry up.'
          : 'The kitchen’s yours. Don’t burn the good pan.';
      return spec(id, text, [
        rodOffer ? { label: 'Ask about fishing', onClick: () => game.story.receiveRod() } : null,
        { label: 'Cook something', onClick: () => game.panels.show(() => town.crafting('kitchen')) },
        fish ? { label: 'Sell fish', onClick: () => game.panels.show(() => ({ name: 'Pell buys fish', role: 'Kitchen', rows: town.sellRows((item) => ITEMS[item].kind === 'fish', 1.15), options: [{ label: 'Done', onClick: () => game.panels.show(() => dialogueFor(game, 'pell')) }], footer: `Pell pays a little over market. ${p.money} bells.` })) } : null,
        job,
        leave(game),
      ]);
    }

    case 'hollis':
      return spec(id, 'Room’s yours as long as the rent’s paid, and the rent is you coming back alive.\n\nBed’s upstairs. Storage is in the cellar.', [
        { label: 'Sleep until morning', onClick: () => town.goToSleep() },
        { label: 'Open storage', onClick: () => game.panels.show(() => town.bank()) },
        leave(game),
      ]);

    case 'bram':
      return spec(id, 'Ore, cores, odd bits of machinery. I buy it all, at a fair-ish price. Fairer if you don’t bring me forty of the same thing.', [
        { label: 'Trade', onClick: () => game.panels.show(() => town.market()) },
        job,
        leave(game),
      ]);

    case 'tavi':
      return game.story.taviDialogue();
  }
}
