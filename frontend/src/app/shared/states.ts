import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-error-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="alert" class="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300"><app-icon name="alert" [size]="22" /></span>
      <p class="font-semibold text-white">{{ title() }}</p>
      <p class="max-w-md text-sm text-slate-400">{{ message() }}</p>
      <button type="button" class="btn-secondary btn-sm mt-1" (click)="retry.emit()"><app-icon name="refresh" [size]="14" /> Reintentar</button>
    </div>
  `,
})
export class ErrorState {
  readonly title = input('Algo salió mal');
  readonly message = input('No pudimos cargar la información. Intenta de nuevo en unos segundos.');
  readonly retry = output<void>();
}

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="surface flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center">
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300"><app-icon [name]="icon()" [size]="22" /></span>
      <p class="font-semibold text-white">{{ title() }}</p>
      <p class="max-w-md text-sm text-slate-400">{{ message() }}</p>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('search');
  readonly title = input('Sin resultados');
  readonly message = input('Prueba con otros filtros.');
}

export const DISCLAIMER_TEXT =
  'CardIA no está afiliada a ninguna institución financiera y no garantiza la aprobación de ningún crédito. Verifica condiciones vigentes con cada institución.';

/** Aviso unico para todas las paginas (mismo texto que el backend). */
@Component({
  selector: 'app-disclaimer',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs leading-relaxed text-amber-100/80">
      <app-icon name="info" [size]="16" class="mt-0.5 text-amber-300" />
      <p><strong class="text-amber-200">Herramienta de educación financiera.</strong> {{ text }}</p>
    </aside>
  `,
})
export class Disclaimer {
  protected readonly text = DISCLAIMER_TEXT;
}
