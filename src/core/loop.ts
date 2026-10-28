export interface LoopCallbacks {
  /** Simulation step at a fixed rate. */
  fixedUpdate(dt: number): void;
  /** Once per animation frame. alpha is how far we are between the last two steps. */
  update(dt: number, alpha: number): void;
}

const MAX_STEPS_PER_FRAME = 5;

export class Loop {
  readonly fixedDt = 1 / 60;
  /** Scales simulation time; 0 pauses the world but keeps rendering. */
  timeScale = 1;
  private accumulator = 0;
  private last = 0;
  private running = false;
  private hitStop = 0;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Freezes the simulation briefly to sell an impact. */
  freeze(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  /** Runs the loop by hand: automated tests use it while the page is hidden and animation frames are paused. */
  advance(seconds: number, frameDt = 1 / 30): void {
    for (let t = 0; t < seconds; t += frameDt) this.tick(frameDt);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const realDt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.tick(realDt);
    requestAnimationFrame(this.frame);
  };

  private tick(realDt: number): void {
    let simDt = realDt * this.timeScale;
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      simDt = 0;
    }
    this.accumulator += simDt;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < MAX_STEPS_PER_FRAME) {
      this.callbacks.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.callbacks.update(realDt, this.accumulator / this.fixedDt);
  }
}
