import { Injectable, computed, signal } from '@angular/core';

const KEY = 'cardia.compare';
export const MAX_COMPARE = 4;

/** Seleccion de tarjetas para el comparador (persistida en localStorage). */
@Injectable({ providedIn: 'root' })
export class CompareStore {
  private readonly _ids = signal<string[]>(this.read());
  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().length);
  readonly full = computed(() => this._ids().length >= MAX_COMPARE);

  has(id: string): boolean {
    return this._ids().includes(id);
  }

  toggle(id: string): void {
    const cur = this._ids();
    if (cur.includes(id)) this.set(cur.filter((x) => x !== id));
    else if (cur.length < MAX_COMPARE) this.set([...cur, id]);
  }

  set(ids: string[]): void {
    const clean = [...new Set(ids)].slice(0, MAX_COMPARE);
    this._ids.set(clean);
    localStorage.setItem(KEY, JSON.stringify(clean));
  }

  clear(): void {
    this.set([]);
  }

  private read(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      return [];
    }
  }
}
