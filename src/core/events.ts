type Handler<T> = (payload: T) => void;

/** Typed publish/subscribe. Systems emit; UI and audio listen. */
export class EventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler<never>>();
    this.handlers.set(type, set);
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) (handler as Handler<Events[K]>)(payload);
  }
}
