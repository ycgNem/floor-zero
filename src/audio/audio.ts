import * as THREE from 'three';

export type SoundName =
  | 'step' | 'swing' | 'hit' | 'weak' | 'pick' | 'yield' | 'bolt' | 'surge' | 'hurt' | 'telegraph'
  | 'slam' | 'kill' | 'coin' | 'pickup' | 'level' | 'ui' | 'splash' | 'bite' | 'catch' | 'deflect'
  | 'heal' | 'valve' | 'lift' | 'roar' | 'full' | 'glint';

export type Ambience = 'town' | 'mine' | 'water' | 'machine';
export type Music = 'town' | 'delve' | 'boss';

const note = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
// D major for the town, D minor pentatonic below.
const TOWN_CHORDS = [[-19, -15, -12, -8], [-22, -19, -15, -12], [-26, -22, -19, -15], [-24, -20, -17, -12]].map((c) => c.map(note));
const TOWN_MELODY = [-7, -5, -3, 0, 2, 5].map(note);
const DELVE_BELLS = [5, 8, 10, 12, 15].map(note);
const BOSS_BASS = [-31, -31, -28, -31, -31, -26, -28, -33].map(note);

interface Out {
  node: AudioNode;
  t: number;
}

/**
 * Every sound is synthesized: noise bursts and oscillators for effects, generated reverb for the
 * caves, looping ambience per area, and slow generative music. Nothing to download.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambienceBus!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private volume = 0.8;
  private musicVolume = 0.6;
  private ambience: Ambience | null = null;
  private ambienceStop: (() => void) | null = null;
  private music: Music | null = null;
  private musicStop: (() => void) | null = null;
  private nextMusic = 0;
  private nextAmbient = 0;
  private bar = 0;
  private readonly listener = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private wantedAmbience: Ambience | null = null;
  private wantedMusic: Music | null = null;
  private wantedReverb = 0.2;

  constructor() {
    const unlock = (): void => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Browsers only allow audio after a gesture, so the context starts on the first click or key. */
  private unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 0.9;
    for (const bus of [this.sfxBus, this.musicBus, this.ambienceBus]) bus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(reverb).connect(this.master);
    this.applyVolumes();
    this.setReverb(this.wantedReverb);
    if (this.wantedAmbience) this.setAmbience(this.wantedAmbience);
    if (this.wantedMusic) this.setMusic(this.wantedMusic);
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
    }
    return buffer;
  }

  setVolumes(volume: number, music: number): void {
    this.volume = volume;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.7, this.ctx.currentTime, 0.05);
  }

  /** How much of everything goes to the cave reverb. */
  setReverb(amount: number): void {
    this.wantedReverb = amount;
    if (this.ctx) this.reverbSend.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.3);
  }

  /** Listener position and facing, for panning and distance. */
  setListener(camera: THREE.Camera): void {
    this.listener.copy(camera.position);
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  }

  // ---------------------------------------------------------------- synthesis primitives

  private env(gain: GainNode, t: number, attack: number, peak: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(out: Out, type: OscillatorType, f0: number, f1: number, attack: number, decay: number, peak: number, delay = 0): void {
    const ctx = this.ctx as AudioContext;
    const t = out.t + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    const gain = ctx.createGain();
    this.env(gain, t, attack, peak, decay);
    osc.connect(gain).connect(out.node);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private burst(out: Out, type: BiquadFilterType, f0: number, f1: number, decay: number, peak: number, o: { q?: number; attack?: number; delay?: number } = {}): void {
    const ctx = this.ctx as AudioContext;
    const t = out.t + (o.delay ?? 0);
    const attack = o.attack ?? 0.004;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    const gain = ctx.createGain();
    this.env(gain, t, attack, peak, decay);
    src.connect(filter).connect(gain).connect(out.node);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  /** A per-sound output: distance falloff and stereo pan for positioned sounds, plus the reverb send. */
  private output(at: THREE.Vector3 | undefined, volume: number): Out | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    let level = volume;
    if (at) {
      const offset = at.clone().sub(this.listener);
      const d = offset.length();
      if (d > 45) return null;
      level *= 1 / (1 + (d / 6) ** 2);
      pan.pan.value = d > 0.01 ? THREE.MathUtils.clamp(offset.dot(this.right) / d, -1, 1) * 0.8 : 0;
    }
    gain.gain.value = level;
    gain.connect(pan);
    pan.connect(this.sfxBus);
    pan.connect(this.reverbSend);
    return { node: gain, t: ctx.currentTime + 0.005 };
  }

  play(name: SoundName, o: { at?: THREE.Vector3; volume?: number } = {}): void {
    const out = this.output(o.at, o.volume ?? 1);
    if (!out) return;
    const r = (spread: number): number => 1 + (Math.random() - 0.5) * spread;
    switch (name) {
      case 'step':
        this.burst(out, 'bandpass', 1300 * r(0.3), 700, 0.07, 0.22, { q: 0.8 });
        this.tone(out, 'sine', 110 * r(0.2), 70, 0.003, 0.06, 0.16);
        break;
      case 'swing':
        this.burst(out, 'bandpass', 500, 2600 * r(0.2), 0.2, 0.32, { q: 1.2, attack: 0.04 });
        break;
      case 'hit':
      case 'weak':
        this.tone(out, 'sine', 160 * r(0.2), 55, 0.002, 0.12, 0.6);
        this.burst(out, 'highpass', 1800, 1800, 0.04, 0.3);
        if (name === 'weak') this.tone(out, 'triangle', 1250, 900, 0.002, 0.12, 0.16);
        break;
      case 'pick': {
        const p = r(0.08);
        this.tone(out, 'sine', 1850 * p, 1840 * p, 0.001, 0.35, 0.16);
        this.tone(out, 'sine', 2790 * p, 2770 * p, 0.001, 0.25, 0.09);
        this.tone(out, 'sine', 4120 * p, 4100 * p, 0.001, 0.18, 0.05);
        this.burst(out, 'bandpass', 3000, 3000, 0.03, 0.3, { q: 2 });
        this.burst(out, 'lowpass', 700, 200, 0.25, 0.18, { attack: 0.02 });
        break;
      }
      case 'yield':
        this.tone(out, 'sine', 1318, 1318, 0.005, 0.5, 0.1);
        this.tone(out, 'sine', 1760, 1760, 0.005, 0.6, 0.08, 0.08);
        break;
      case 'glint':
        // A bright shimmer: something catching the light in the rock.
        [3520, 4186, 4699, 5274].forEach((f, i) => this.tone(out, 'sine', f * r(0.01), f, 0.002, 0.35, 0.035, i * 0.045));
        break;
      case 'bolt':
        this.tone(out, 'sawtooth', 420, 90, 0.002, 0.16, 0.2);
        this.burst(out, 'highpass', 2500, 2500, 0.05, 0.25);
        break;
      case 'surge':
        this.tone(out, 'sine', 180, 900, 0.05, 0.45, 0.3);
        this.tone(out, 'sine', 360, 1800, 0.05, 0.4, 0.1);
        this.burst(out, 'bandpass', 800, 3000, 0.4, 0.15, { attack: 0.05 });
        break;
      case 'hurt':
        this.tone(out, 'sine', 90, 45, 0.003, 0.25, 0.5);
        this.burst(out, 'lowpass', 700, 300, 0.15, 0.35);
        break;
      case 'telegraph':
        this.burst(out, 'bandpass', 2200, 1400, 0.25, 0.16, { q: 6, attack: 0.03 });
        this.tone(out, 'triangle', 880, 860, 0.002, 0.12, 0.07);
        break;
      case 'slam':
        this.tone(out, 'sine', 70, 28, 0.005, 0.8, 0.8);
        this.burst(out, 'lowpass', 400, 120, 0.6, 0.5, { attack: 0.01 });
        break;
      case 'kill':
        this.burst(out, 'bandpass', 900, 250, 0.35, 0.3);
        this.tone(out, 'triangle', 300, 80, 0.005, 0.3, 0.14);
        break;
      case 'coin':
        this.tone(out, 'triangle', 1976, 1976, 0.002, 0.12, 0.08);
        this.tone(out, 'triangle', 2637, 2637, 0.002, 0.25, 0.08, 0.07);
        break;
      case 'pickup':
        this.tone(out, 'sine', 880, 880, 0.003, 0.15, 0.08);
        this.tone(out, 'sine', 1320, 1320, 0.003, 0.2, 0.07, 0.05);
        break;
      case 'level':
        [note(5), note(8), note(12), note(17)].forEach((f, i) => this.tone(out, 'triangle', f, f, 0.005, 0.7, 0.13, i * 0.1));
        break;
      case 'ui':
        this.tone(out, 'triangle', 1400, 1400, 0.001, 0.04, 0.04);
        break;
      case 'splash':
        this.burst(out, 'lowpass', 2500, 300, 0.45, 0.35, { attack: 0.01 });
        this.burst(out, 'highpass', 3000, 3000, 0.15, 0.1);
        break;
      case 'bite':
        this.burst(out, 'lowpass', 1500, 400, 0.15, 0.25);
        this.tone(out, 'sine', 600, 300, 0.002, 0.08, 0.14);
        break;
      case 'catch':
        this.burst(out, 'lowpass', 2500, 400, 0.4, 0.3, { attack: 0.01 });
        this.tone(out, 'triangle', 1318, 1318, 0.005, 0.4, 0.08, 0.15);
        this.tone(out, 'triangle', 1976, 1976, 0.005, 0.5, 0.07, 0.25);
        break;
      case 'deflect':
        this.tone(out, 'sine', 2400, 2380, 0.001, 0.6, 0.18);
        this.tone(out, 'sine', 3600, 3570, 0.001, 0.4, 0.1);
        this.burst(out, 'highpass', 4000, 4000, 0.05, 0.3);
        break;
      case 'heal':
        this.tone(out, 'sine', 523, 784, 0.05, 0.4, 0.1);
        break;
      case 'valve':
        this.burst(out, 'bandpass', 300, 650, 0.6, 0.2, { q: 8, attack: 0.1 });
        this.tone(out, 'sine', 120, 110, 0.05, 0.5, 0.12);
        break;
      case 'lift':
        this.burst(out, 'lowpass', 220, 140, 2.4, 0.35, { attack: 0.4 });
        this.tone(out, 'triangle', 640, 630, 0.002, 0.3, 0.06, 0.2);
        this.tone(out, 'triangle', 480, 470, 0.002, 0.3, 0.05, 1.6);
        break;
      case 'roar':
        this.tone(out, 'sawtooth', 110, 70, 0.15, 1.1, 0.3);
        this.tone(out, 'sawtooth', 116, 73, 0.15, 1.1, 0.25);
        this.burst(out, 'bandpass', 500, 250, 1.1, 0.3, { q: 2, attack: 0.1 });
        break;
      case 'full':
        this.tone(out, 'triangle', 330, 330, 0.003, 0.1, 0.1);
        this.tone(out, 'triangle', 262, 262, 0.003, 0.15, 0.1, 0.12);
        break;
    }
  }

  // ---------------------------------------------------------------- ambience and music

  setAmbience(kind: Ambience | null): void {
    this.wantedAmbience = kind;
    if (!this.ctx || kind === this.ambience) return;
    this.ambienceStop?.();
    this.ambience = kind;
    this.ambienceStop = kind ? this.startBed(this.ambienceBus, kind) : null;
  }

  setMusic(kind: Music | null): void {
    this.wantedMusic = kind;
    if (!this.ctx || kind === this.music) return;
    this.musicStop?.();
    this.music = kind;
    this.musicStop = kind ? this.startBed(this.musicBus, kind === 'delve' ? 'drone' : kind === 'boss' ? 'tension' : 'none') : null;
    this.nextMusic = this.ctx.currentTime + 0.5;
    this.bar = 0;
  }

  /** A looping bed of filtered noise and held tones; returns a stop function that fades it out. */
  private startBed(bus: GainNode, kind: Ambience | 'drone' | 'tension' | 'none'): () => void {
    const ctx = this.ctx as AudioContext;
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0.0001, ctx.currentTime);
    fade.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
    fade.connect(bus);
    const sources: AudioScheduledSourceNode[] = [];
    const noiseBed = (type: BiquadFilterType, freq: number, level: number, wobble = 0): void => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = level;
      src.connect(filter).connect(gain).connect(fade);
      if (wobble > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07 + Math.random() * 0.08;
        const depth = ctx.createGain();
        depth.gain.value = wobble;
        lfo.connect(depth).connect(filter.frequency);
        lfo.start();
        sources.push(lfo);
      }
      src.start();
      sources.push(src);
    };
    const hum = (freq: number, level: number, type: OscillatorType = 'sine'): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = level;
      osc.connect(gain).connect(fade);
      osc.start();
      sources.push(osc);
    };
    switch (kind) {
      case 'town':
        noiseBed('lowpass', 500, 0.08, 250);
        break;
      case 'mine':
        noiseBed('lowpass', 220, 0.2);
        hum(38, 0.05);
        break;
      case 'water':
        noiseBed('bandpass', 600, 0.12, 300);
        noiseBed('lowpass', 200, 0.12);
        break;
      case 'machine':
        noiseBed('lowpass', 320, 0.16);
        hum(50, 0.06);
        hum(100, 0.03);
        hum(150, 0.012, 'triangle');
        break;
      case 'drone':
        hum(note(-31), 0.05);
        hum(note(-24), 0.035);
        hum(note(-24) * 1.003, 0.02, 'triangle');
        break;
      case 'tension':
        hum(note(-24), 0.03, 'sawtooth');
        hum(note(-23), 0.015, 'sawtooth');
        break;
      case 'none':
        break;
    }
    return () => {
      const now = ctx.currentTime;
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(fade.gain.value, now);
      fade.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      for (const src of sources) src.stop(now + 1.6);
    };
  }

  /** Call every frame: schedules drips, distant work, and the music's next notes. */
  update(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.ambience && now >= this.nextAmbient) {
      const out: Out = { node: this.ambienceBus, t: now };
      const send: Out = { node: this.reverbSend, t: now };
      switch (this.ambience) {
        case 'mine':
        case 'water': {
          // A drip somewhere in the dark, mostly heard through the reverb.
          const f = 1400 + Math.random() * 1200;
          this.tone(out, 'sine', f, f * 0.7, 0.001, 0.1, 0.025);
          this.tone(send, 'sine', f, f * 0.7, 0.001, 0.1, 0.06);
          this.nextAmbient = now + (this.ambience === 'water' ? 0.8 : 1.5) + Math.random() * 3.5;
          break;
        }
        case 'machine':
          this.tone(out, 'sine', 62, 40, 0.01, 0.28, 0.16);
          this.nextAmbient = now + 1.4;
          break;
        case 'town':
          // The forge, across the plaza.
          this.tone(send, 'triangle', 1500, 1490, 0.001, 0.2, 0.04);
          this.tone(send, 'triangle', 1500, 1490, 0.001, 0.2, 0.03, 0.42);
          this.nextAmbient = now + 3 + Math.random() * 6;
          break;
      }
    }
    if (this.music && now >= this.nextMusic) this.scheduleMusic(now);
  }

  private scheduleMusic(now: number): void {
    const bus: Out = { node: this.musicBus, t: now };
    const wet: Out = { node: this.reverbSend, t: now };
    switch (this.music) {
      case 'town': {
        // A slow pad chord every six seconds, with the odd plucked note over it.
        const chord = TOWN_CHORDS[this.bar % TOWN_CHORDS.length] ?? [];
        for (const f of chord) {
          this.tone(bus, 'triangle', f, f, 1.6, 4.8, 0.035);
          this.tone(bus, 'triangle', f * 1.004, f * 1.004, 1.6, 4.8, 0.02);
        }
        for (let i = 0; i < 3; i++) {
          if (Math.random() < 0.55) {
            const f = TOWN_MELODY[Math.floor(Math.random() * TOWN_MELODY.length)] ?? 440;
            this.tone(bus, 'triangle', f, f, 0.005, 1.4, 0.05, 1 + i * 1.6 + Math.random() * 0.3);
            this.tone(wet, 'triangle', f, f, 0.005, 1.4, 0.04, 1 + i * 1.6);
          }
        }
        this.bar++;
        this.nextMusic = now + 6;
        break;
      }
      case 'delve': {
        // Far-off bells over the drone.
        const f = DELVE_BELLS[Math.floor(Math.random() * DELVE_BELLS.length)] ?? 880;
        this.tone(bus, 'sine', f, f, 0.003, 3, 0.035);
        this.tone(bus, 'sine', f * 2.76, f * 2.76, 0.003, 1.2, 0.01);
        this.tone(wet, 'sine', f, f, 0.003, 3, 0.07);
        this.nextMusic = now + 4 + Math.random() * 6;
        break;
      }
      case 'boss': {
        // Eighth notes at 120 bpm, a drum on the beat, one bar at a time.
        for (let i = 0; i < 8; i++) {
          const f = BOSS_BASS[i] ?? 73;
          this.tone(bus, 'sawtooth', f, f, 0.005, 0.2, 0.07, i * 0.25);
          if (i % 2 === 0) this.tone(bus, 'sine', 90, 45, 0.003, 0.22, 0.25, i * 0.25);
        }
        this.nextMusic = now + 2;
        break;
      }
    }
  }
}
