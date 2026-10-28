export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'jump' | 'crouch' | 'dash' | 'interact'
  | 'attack' | 'ability' | 'secondary' | 'swap'
  | 'food1' | 'food2' | 'food3' | 'food4'
  | 'map' | 'card' | 'pause' | 'debug'
  | 'lookLeft' | 'lookRight' | 'lookUp' | 'lookDown';

/** Keyboard codes, plus Mouse0..Mouse4 for buttons. */
export const DEFAULT_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyE: 'interact', Mouse0: 'attack', Mouse2: 'ability', KeyF: 'secondary', KeyQ: 'swap',
  Digit1: 'food1', Digit2: 'food2', Digit3: 'food3', Digit4: 'food4',
  KeyM: 'map', Tab: 'card', Escape: 'pause', Backquote: 'debug',
  ArrowLeft: 'lookLeft', ArrowRight: 'lookRight', ArrowUp: 'lookUp', ArrowDown: 'lookDown',
};

const KEY_LOOK_SPEED = 2.2; // radians per second for arrow-key look

export class Input {
  bindings: Record<string, Action> = { ...DEFAULT_BINDINGS };
  sensitivity = 0.0022;
  invertY = false;
  /** False while a menu owns the keyboard. Look and movement are ignored. */
  gameplay = true;

  private readonly down = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private lookX = 0;
  private lookY = 0;
  private readonly lockListeners = new Set<(locked: boolean) => void>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      const action = this.bindings[e.code];
      if (action === 'card' || action === 'jump' || e.code === 'Tab') e.preventDefault();
      if (!action) return;
      if (!e.repeat) this.press(action);
    });
    window.addEventListener('keyup', (e) => {
      const action = this.bindings[e.code];
      if (action) this.down.delete(action);
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const action = this.bindings[`Mouse${e.button}`];
      if (action) this.press(action);
    });
    window.addEventListener('mouseup', (e) => {
      const action = this.bindings[`Mouse${e.button}`];
      if (action) this.down.delete(action);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
    window.addEventListener('wheel', () => {
      if (this.locked) this.pressed.add('swap');
    }, { passive: true });
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      for (const listener of this.lockListeners) listener(this.locked);
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    if (this.locked) return;
    const result: unknown = this.canvas.requestPointerLock();
    if (result instanceof Promise) result.catch(() => undefined);
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  onLockChange(listener: (locked: boolean) => void): void {
    this.lockListeners.add(listener);
  }

  isDown(action: Action): boolean {
    return this.gameplay && this.down.has(action);
  }

  /** True if pressed since the last clearPressed(). Doesn't consume. */
  wasPressed(action: Action): boolean {
    return this.gameplay && this.pressed.has(action);
  }

  /** For per-frame UI handling: returns true once per press. */
  consume(action: Action): boolean {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  /** Mouse plus arrow-key look for this frame, in radians. */
  consumeLook(dt: number): { yaw: number; pitch: number } {
    let yaw = this.lookX * this.sensitivity;
    let pitch = this.lookY * this.sensitivity;
    this.lookX = 0;
    this.lookY = 0;
    if (!this.gameplay) return { yaw: 0, pitch: 0 };
    if (this.down.has('lookLeft')) yaw -= KEY_LOOK_SPEED * dt;
    if (this.down.has('lookRight')) yaw += KEY_LOOK_SPEED * dt;
    if (this.down.has('lookUp')) pitch -= KEY_LOOK_SPEED * dt;
    if (this.down.has('lookDown')) pitch += KEY_LOOK_SPEED * dt;
    if (this.invertY) pitch = -pitch;
    return { yaw, pitch };
  }

  /** Lets tests and automation drive actions without real devices. */
  simulate(action: Action, held: boolean): void {
    if (held) this.press(action);
    else this.down.delete(action);
  }

  private press(action: Action): void {
    this.down.add(action);
    this.pressed.add(action);
  }
}
