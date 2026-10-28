import type { Game } from '../game';
import { acceptJob, activeJob, describeJob, postedJob } from '../story/jobs';
import { mainObjective } from '../story/story';
import type { PanelAction, PanelSpec } from '../ui/panels';

/** The noticeboard: today's posted job and the main task. */
export function noticeboard(game: Game, where: string): PanelSpec {
  const posted = postedJob(game);
  const active = activeJob(game);
  const done = game.state.objective?.done ?? false;
  const options: PanelAction[] = [];
  let jobText: string;
  if (done) jobText = 'Today’s job is done. New work goes up in the morning.';
  else if (active) jobText = `You took today’s job: ${describeJob(active)}.`;
  else if (posted) {
    jobText = `Posted today: ${describeJob(posted)}.`;
    options.push({ label: 'Take the job', onClick: () => acceptJob(game, posted) });
  } else jobText = 'Nothing posted today.';
  options.push({ label: 'Done', onClick: () => game.panels.close() });
  return {
    name: 'Noticeboard',
    role: where,
    text: `Day ${game.state.day}.\n\n${jobText}\n\nYour main task: ${mainObjective(game)}.`,
    options,
  };
}
