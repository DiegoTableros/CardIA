import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/guards';
import { Shell } from './shared/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · CardIA',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'CardIA · Tarjetas de crédito explicadas',
        loadComponent: () => import('./features/home/home').then((m) => m.HomePage),
      },
      {
        path: 'tarjetas',
        title: 'Catálogo · CardIA',
        loadComponent: () => import('./features/catalog/catalog').then((m) => m.CatalogPage),
      },
      {
        path: 'tarjetas/:id',
        title: 'Detalle de tarjeta · CardIA',
        loadComponent: () => import('./features/card-detail/card-detail').then((m) => m.CardDetailPage),
      },
      {
        path: 'comparar',
        title: 'Comparador · CardIA',
        loadComponent: () => import('./features/compare/compare').then((m) => m.ComparePage),
      },
      {
        path: 'encuentra-tu-tarjeta',
        title: 'Encuentra tu tarjeta · CardIA',
        loadComponent: () => import('./features/recommend/recommend').then((m) => m.RecommendPage),
      },
      { path: 'para-ti', redirectTo: 'encuentra-tu-tarjeta' },
      {
        path: 'asistente',
        title: 'Asistente · CardIA',
        loadComponent: () => import('./features/chat/chat').then((m) => m.ChatPage),
      },
      {
        path: 'perfiles',
        canActivate: [adminGuard],
        title: 'Perfiles · CardIA',
        loadComponent: () => import('./features/bi/bi').then((m) => m.BiPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        title: 'Administración · CardIA',
        loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
