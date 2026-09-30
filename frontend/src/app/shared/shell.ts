import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { CompareStore } from './compare-store';
import { Icon } from './icon';
import { Logo } from './logo';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { path: '/', label: 'Inicio', icon: 'home', exact: true },
  { path: '/tarjetas', label: 'Catálogo', icon: 'cards' },
  { path: '/para-ti', label: 'Para ti', icon: 'sparkles' },
  { path: '/asistente', label: 'Asistente', icon: 'chat' },
  { path: '/comparar', label: 'Comparar', icon: 'compare' },
  { path: '/perfiles', label: 'BI perfiles', icon: 'chart' },
  { path: '/admin', label: 'Admin', icon: 'shield', admin: true },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">
      Saltar al contenido
    </a>
    <header class="sticky top-0 z-40 border-b border-white/6 bg-ink-950/70 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <a routerLink="/" aria-label="CardIA, inicio"><app-logo [size]="32" /></a>
        <nav class="ml-4 hidden items-center gap-1 lg:flex" aria-label="Principal">
          @for (item of nav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="!text-white bg-white/8"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              class="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <app-icon [name]="item.icon" [size]="16" />
              {{ item.label }}
              @if (item.path === '/comparar' && compare.count()) {
                <span class="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-hot-500 px-1 text-[10px] font-bold text-white">{{ compare.count() }}</span>
              }
            </a>
          }
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <div class="hidden items-center gap-2.5 rounded-xl border border-white/8 bg-white/4 py-1.5 pr-3 pl-1.5 sm:flex">
            <span class="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
              {{ initials() }}
            </span>
            <span class="text-left leading-tight">
              <span class="block text-xs font-semibold text-white">{{ auth.user()?.full_name }}</span>
              <span class="block text-[10px] tracking-wide text-slate-400 uppercase">{{ auth.isAdmin() ? 'Administrador' : 'Usuario' }}</span>
            </span>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="auth.logout()" title="Cerrar sesión">
            <app-icon name="logout" [size]="16" /><span class="hidden sm:inline">Salir</span>
          </button>
          <button type="button" class="btn-ghost btn-sm lg:hidden" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-label="Abrir menú">
            <app-icon [name]="menuOpen() ? 'x' : 'menu'" [size]="20" />
          </button>
        </div>
      </div>
      @if (menuOpen()) {
        <nav class="animate-fade-up border-t border-white/6 px-4 py-3 lg:hidden" aria-label="Principal móvil">
          <div class="grid grid-cols-2 gap-2">
            @for (item of nav(); track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!border-brand-400/50 !bg-brand-500/15 !text-white"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                class="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-300"
              >
                <app-icon [name]="item.icon" [size]="16" /> {{ item.label }}
              </a>
            }
          </div>
        </nav>
      }
    </header>

    <main id="main" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <router-outlet />
    </main>

    @if (showChatFab()) {
      <a
        routerLink="/asistente"
        class="group fixed right-5 bottom-5 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-hot-500 py-3 pr-5 pl-4 font-semibold text-white shadow-(--shadow-glow) transition hover:scale-105"
        aria-label="Abrir asistente CardIA"
      >
        <span class="relative flex h-2.5 w-2.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60"></span><span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-white"></span></span>
        <app-icon name="chat" [size]="18" />
        <span class="hidden text-sm sm:inline">Pregúntale a CardIA</span>
      </a>
    }

    <footer class="border-t border-white/6">
      <div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>CardIA · Proyecto educativo de Machine Learning y agentes IA. Datos públicos de Banxico y CONDUSEF.</p>
        <p>No afiliado a ninguna institución financiera · No es asesoría financiera.</p>
      </div>
    </footer>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly compare = inject(CompareStore);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => {
        this.menuOpen.set(false);
        return (e as NavigationEnd).urlAfterRedirects;
      }),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showChatFab = computed(() => !this.url().startsWith('/asistente'));
  protected readonly nav = computed(() => NAV.filter((n) => !n.admin || this.auth.isAdmin()));
  protected readonly initials = computed(() =>
    (this.auth.user()?.full_name ?? 'U')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}
