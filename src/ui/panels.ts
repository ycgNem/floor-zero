import type { Game } from '../game';
import { button, el } from './dom';

export interface PanelAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface PanelRow {
  title: string;
  detail?: string;
  /** Right-aligned: price, level, count. */
  meta?: string;
  actions?: PanelAction[];
  dim?: boolean;
}

export interface PanelSpec {
  name: string;
  role?: string;
  /** Spoken or descriptive text. Blank lines split paragraphs. */
  text?: string;
  rows?: PanelRow[];
  /** Dialogue choices and footer buttons. */
  options?: PanelAction[];
  footer?: string;
}

/**
 * Modal panels for dialogue, shops, crafting, and the bank. A panel is rebuilt from its
 * builder after every action, so it always shows the current state.
 */
export class Panels {
  private readonly root: HTMLElement;
  private builder: (() => PanelSpec) | null = null;

  constructor(
    container: HTMLElement,
    private readonly game: Game,
  ) {
    this.root = el('div', 'panel-layer', container);
    this.root.style.display = 'none';
    game.onFrame(() => {
      if (this.builder && game.input.consume('pause')) this.close();
    });
  }

  get open(): boolean {
    return this.builder !== null;
  }

  show(builder: () => PanelSpec): void {
    this.builder = builder;
    if (!this.game.panelOpen) this.game.openPanel();
    this.render();
  }

  refresh(): void {
    if (this.builder) this.render();
  }

  close(): void {
    if (!this.builder) return;
    this.builder = null;
    this.root.style.display = 'none';
    this.root.replaceChildren();
    this.game.closePanel();
  }

  private wrap(action: PanelAction): () => void {
    return () => {
      const before = this.builder;
      action.onClick();
      if (this.builder && this.builder === before) this.render();
    };
  }

  private render(): void {
    if (!this.builder) return;
    const spec = this.builder();
    this.root.replaceChildren();
    this.root.style.display = '';
    const box = el('div', 'panel', this.root);
    const head = el('div', 'panel-head', box);
    el('div', 'panel-name', head, spec.name);
    if (spec.role) el('div', 'panel-role', head, spec.role);
    button('×', head, () => this.close(), 'panel-close');
    if (spec.text) {
      const text = el('div', 'panel-text', box);
      for (const para of spec.text.split('\n\n')) el('p', '', text, para);
    }
    if (spec.rows && spec.rows.length > 0) {
      const list = el('div', 'panel-rows', box);
      for (const row of spec.rows) {
        const r = el('div', `panel-row${row.dim ? ' dim' : ''}`, list);
        const info = el('div', 'row-info', r);
        el('div', 'row-title', info, row.title);
        if (row.detail) el('div', 'row-detail', info, row.detail);
        if (row.meta) el('div', 'row-meta', r, row.meta);
        const acts = el('div', 'row-actions', r);
        for (const action of row.actions ?? []) {
          const b = button(action.label, acts, this.wrap(action), 'btn small');
          b.disabled = action.disabled ?? false;
        }
      }
    }
    if (spec.options && spec.options.length > 0) {
      const opts = el('div', 'panel-options', box);
      for (const option of spec.options) {
        const b = button(option.label, opts, this.wrap(option), 'btn');
        b.disabled = option.disabled ?? false;
      }
    }
    if (spec.footer) el('div', 'panel-footer', box, spec.footer);
  }
}
