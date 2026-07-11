/**
 * Shared type for Alpine x-data component factories.
 * Magic methods ($dispatch, $el, $refs, $nextTick) are injected at runtime;
 * declare them here once so component factories stay typed without `any` casts.
 *
 * Use as: `type Foo = Partial<AlpineComponent> & { ...your state... }`
 * The Partial<> lets the returned object literal omit the magic methods
 * (Alpine adds them), while still typing them as available in method bodies.
 */
export interface AlpineComponent {
  $dispatch(name: string, detail: unknown): void;
  $el: HTMLElement;
  $refs: Record<string, HTMLElement>;
  $nextTick(fn: () => void): void;
  $watch(expr: string, fn: () => void): void;
  $store: { doc: any; shell: any; deal: any; parties: any; signatures: any };
}

