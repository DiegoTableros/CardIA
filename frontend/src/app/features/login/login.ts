import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { CardArt } from '../../shared/card-art';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CardArt, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <!-- Hero -->
      <section class="relative hidden overflow-hidden border-r border-white/6 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_30rem_at_30%_30%,rgba(139,92,246,.35),transparent_60%),radial-gradient(30rem_25rem_at_80%_80%,rgba(6,182,212,.25),transparent_60%)]"></div>
        <app-logo [size]="40" class="relative" />
        <div class="relative mx-auto w-full max-w-lg py-10">
          <div class="relative h-80">
            <div class="animate-float-slow absolute top-4 left-0 w-64 [--r:-12deg]">
              <app-card-art name="Tarjeta clásica" cardClass="Clásica" imageUrl="/cards/004.webp" orientation="landscape" [padded]="false" />
            </div>
            <div class="animate-float absolute top-0 right-0 w-64 [--r:10deg] [animation-delay:-2s]">
              <app-card-art name="Tarjeta azul" cardClass="Clásica" imageUrl="/cards/064.webp" orientation="landscape" [padded]="false" />
            </div>
            <div class="animate-float absolute bottom-0 left-1/2 w-72 -translate-x-1/2 [--r:-3deg] [animation-delay:-4s]">
              <app-card-art name="Tarjeta oro" cardClass="Oro" imageUrl="/cards/060.webp" orientation="landscape" [padded]="false" />
            </div>
          </div>
        </div>
        <div class="relative max-w-lg">
          <h1 class="text-4xl leading-tight font-bold">Encuentra y entiende <span class="gradient-text">tu tarjeta de crédito.</span></h1>
          <p class="mt-4 text-slate-400">
            CardIA te permite explorar tarjetas del mercado mexicano, encontrar la mejor adaptada a tu perfil y resolver tus dudas con un
            asistente, todo con datos oficiales de Banxico y CONDUSEF.
          </p>
        </div>
      </section>

      <!-- Formulario -->
      <section class="flex items-center justify-center px-5 py-12">
        <div class="w-full max-w-sm animate-fade-up">
          <app-logo [size]="36" class="mb-10 lg:hidden" />
          <h2 class="text-3xl font-bold">Bienvenido</h2>
          <p class="mt-2 text-sm text-slate-400">Inicia sesión para explorar CardIA.</p>

          @if (expired()) {
            <p class="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200" role="status">
              Tu sesión expiró. Vuelve a iniciar sesión.
            </p>
          }

          <form class="mt-8 space-y-4" (ngSubmit)="submit()" #f="ngForm">
            <div>
              <label for="email" class="label">Usuario (correo)</label>
              <div class="relative">
                <app-icon name="user" [size]="16" class="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500" />
                <input id="email" name="email" type="email" class="input pl-10" autocomplete="username" required [(ngModel)]="email" placeholder="tu@correo.com" />
              </div>
            </div>
            <div>
              <label for="password" class="label">Contraseña</label>
              <div class="relative">
                <app-icon name="lock" [size]="16" class="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  [type]="showPwd() ? 'text' : 'password'"
                  class="input pr-20 pl-10"
                  autocomplete="current-password"
                  required
                  [(ngModel)]="password"
                  placeholder="••••••••"
                />
                <button type="button" class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-white" (click)="showPwd.set(!showPwd())">
                  {{ showPwd() ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </div>

            @if (error()) {
              <p class="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{{ error() }}</p>
            }

            <button type="submit" class="btn-primary w-full py-3" [disabled]="loading() || !f.valid">
              @if (loading()) {
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> Entrando…
              } @else {
                Iniciar sesión <app-icon name="arrow" [size]="16" />
              }
            </button>
          </form>

          <div class="mt-8 rounded-xl border border-white/8 bg-white/3 p-4">
            <p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Cuentas de demostración</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button type="button" class="btn-secondary btn-sm justify-start" (click)="fill('demo@cardia.local', 'demo1234')">
                <app-icon name="user" [size]="14" /> Usuario
              </button>
              <button type="button" class="btn-secondary btn-sm justify-start" (click)="fill('admin@cardia.local', 'admin1234')">
                <app-icon name="shield" [size]="14" /> Admin
              </button>
            </div>
          </div>
          <p class="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
            Herramienta de educación financiera. No pedimos datos sensibles ni estamos afiliados a ningún banco.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly next = input<string>();
  readonly expired = input<string>();

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly showPwd = signal(false);

  fill(email: string, password: string): void {
    this.email = email;
    this.password = password;
    this.submit();
  }

  submit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl(this.next() || '/'),
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.status === 401 ? 'Usuario o contraseña incorrectos.' : 'No pudimos conectar. Intenta de nuevo en unos segundos.');
      },
    });
  }
}
