import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { cardTheme } from '../core/format';
import { CardVisual } from './card-visual';

/**
 * Imagen real de la tarjeta sobre un "escenario" uniforme (mismo aspecto para tarjetas verticales y horizontales).
 * Si no hay imagen o falla la carga, usa la ilustracion generada (CardVisual).
 */
@Component({
  selector: 'app-card-art',
  imports: [CardVisual],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (imageUrl() && !failed()) {
      <div class="relative grid aspect-[1.586] w-full place-items-center overflow-visible" [class.p-[4%]]="padded()">
        <div class="pointer-events-none absolute inset-[12%] rounded-full opacity-60 blur-2xl" [class]="'bg-gradient-to-br ' + theme().bg"></div>
        <img
          [src]="imageUrl()"
          [alt]="'Tarjeta ' + name()"
          loading="lazy"
          decoding="async"
          class="relative h-full w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] select-none"
          (error)="failed.set(true)"
          draggable="false"
        />
      </div>
    } @else {
      <app-card-visual [name]="name()" [institution]="institution()" [cardClass]="cardClass()" />
    }
  `,
})
export class CardArt {
  readonly name = input.required<string>();
  readonly institution = input('');
  readonly cardClass = input('Clásica');
  readonly imageUrl = input<string | null | undefined>(null);
  readonly orientation = input<string | null | undefined>(null);
  readonly padded = input(true);
  protected readonly failed = signal(false);
  protected readonly portrait = computed(() => this.orientation() === 'portrait');
  protected readonly theme = computed(() => cardTheme(this.cardClass()));
}
