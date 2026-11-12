import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';
import { authGuard } from './config/guards/auth.guard'
import { nonAuthGuard } from './config/guards/non-auth.guard';
import { NonLayoutComponent } from './shared/components/non-layout/non-layout.component';
import { permissionsGuard } from './config/guards/permissions.guard';
import { adminGuard } from './config/guards/admin.guard';
import { ActivityListComponent} from "@/app/activity-list/activity-list.component";


export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {   path: '', component: NonLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent,
        canActivate: [nonAuthGuard]
      },
      { path: 'recovery-password', loadComponent: () => import('./pages/recovery-password/recovery-password.component').then(c => c.RecoveryPasswordComponent),
        canActivate: [nonAuthGuard]
      },
      { path: 'resetPwd', loadComponent: () => import('./pages/generate-password/generate-password.component').then(c => c.GeneratePasswordComponent),
        canActivate: [nonAuthGuard]
      },
      {
        path: 'payment',
        loadComponent: () => import('./services/payments/payment.component').then(c => c.PaymentComponent)
      },
      { path: 'payment', loadComponent: () => import('./pages/payment-links/make-payment-form/make-payment-form.component' ).then(c => c.MakePaymentFormComponent)},
      { path: '404', loadComponent: () => import('./pages/not-found/not-found.component').then(c => c.NotFoundComponent)},
    ]
  },
  {
    path: '', component: MainLayoutComponent,
    children: [
      {
        path:'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component')
            .then(c => c.DashboardComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'comercios',
        loadComponent: () =>
          import('./pages/merchants/merchants.component')
            .then(c => c.MerchantsComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'msi-management',
        loadComponent: () =>
          import('./pages/msi-management/msi-management.component')
            .then(c => c.MsiManagementComponent),
        canActivate: [permissionsGuard, adminGuard]
      },
      {
        path:'comercios/create',
        loadComponent: () =>
          import('./pages/merchants/new-merchant-form/new-merchant-form.component')
            .then(c => c.NewMerchantFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'comercios/edit/:id',
        loadComponent: () =>
          import('./pages/merchants/new-merchant-form/new-merchant-form.component')
            .then(c => c.NewMerchantFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'comercios/detail/:id',
        loadComponent: () =>
          import('./pages/merchants/merchant-detail/merchant-detail.component'),

      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./pages/clients/clients.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'clientes/edit/:id',
        loadComponent: () =>
          import('./pages/clients/new-client-form/new-client-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'clientes/detail/:id',
        loadComponent: () =>
          import('./pages/clients/clients-detail/clients-detail.component'),
      },
      {
        path: 'clientes/create',
        loadComponent: () =>
          import('./pages/clients/new-client-form/new-client-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'dispositivos',
        loadComponent: () =>
          import('./pages/devices/devices.component')
            .then(c => c.DevicesComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'tarjetas',
        loadComponent: () =>
          import('./pages/cards/cards.component')
            .then(c => c.CardsComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'tarjetas/create',
        loadComponent: () =>
          import('./pages/cards/new-card-form/new-card-form.component')
            .then(c => c.NewCardFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'tarjetas/edit/:id',
        loadComponent: () =>
          import('./pages/cards/new-card-form/new-card-form.component')
            .then(c => c.NewCardFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'tarjetas/detail/:id',
        loadComponent: () =>
          import('./pages/cards/card-detail/card-detail.component')
            .then(c => c.CardDetailComponent),
      },
      {
        path: 'tarjetas/upload',
        loadComponent: () =>
          import('./pages/cards/add-card-file/add-card-file.component')
            .then(c => c.AddCardFileComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'movimientos/transacciones',
        loadComponent: () =>
          import('./pages/movements/transactions/transactions.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'movimientos/transacciones-mejoradas',
        loadComponent: () =>
          import('./pages/movements/transactions/enhanced-transactions.component')
            .then(c => c.EnhancedTransactionsComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'movimientos/pos-json',
        loadComponent: () =>
          import('./pages/movements/pos-json/pos-json.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'movimientos/tickets',
        loadComponent: () =>
          import('./pages/movements/tickets/tickets.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'movimientos/contracargos',
        loadComponent: () =>
          import('./pages/movements/contracharges/contracharges.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'archivos/:type',
        loadComponent: () =>
          import('./pages/files/files.component')
            .then(c => c.FilesComponent),
        canActivate: [permissionsGuard]
      },

      {
        path: 'links-de-pago',
        loadComponent: () =>
          import('./pages/payment-links/payment-links.component')
            .then(c => c.PaymentLinksComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'links-de-pago/create',
        loadComponent: () =>
          import('./pages/payment-links/new-payment-link/new-payment-link.component')
            .then(c => c.NewPaymentLinkComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'links-de-pago/lista',
        loadComponent: () =>
          import('./pages/payment-links/list-payment-link/list-payment-link.component'),
        //canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/tipo-de-personas',
        loadComponent: () =>
          import('./pages/catalogs/person-type/person-type.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/tipo-de-personas/create',
        loadComponent: () =>
          import('./pages/catalogs/person-type/new-person-type-form/new-person-type-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/tipo-de-personas/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/person-type/new-person-type-form/new-person-type-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/agregadores',
        loadComponent: () =>
          import('./pages/catalogs/aggregator/aggregator.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/agregadores/create',
        loadComponent: () =>
          import('./pages/catalogs/aggregator/new-aggregator-form/new-aggregator-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/agregadores/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/aggregator/new-aggregator-form/new-aggregator-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/esq-transaccional',
        loadComponent: () =>
          import('./pages/catalogs/transaction-schema/transaction-schema.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/esq-transaccional/create',
        loadComponent: () =>
          import('./pages/catalogs/transaction-schema/new-transaction-schema-form/new-transaction-schema-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/esq-transaccional/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/transaction-schema/new-transaction-schema-form/new-transaction-schema-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/giros',
        loadComponent: () =>
          import('./pages/catalogs/business/business.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/giros/create',
        loadComponent: () =>
          import('./pages/catalogs/business/new-business-form/new-business-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/giros/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/business/new-business-form/new-business-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/bancos',
        loadComponent: () =>
          import('./pages/catalogs/banks/banks.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/bancos/create',
        loadComponent: () =>
          import('./pages/catalogs/banks/new-bank-form/new-bank-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/bancos/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/banks/new-bank-form/new-bank-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/red-logica',
        loadComponent: () =>
          import('./pages/catalogs/network-types/network-types.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/red-logica/create',
        loadComponent: () =>
          import('./pages/catalogs/network-types/new-network-form/new-network-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/red-logica/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/network-types/new-network-form/new-network-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/procesadores',
        loadComponent: () =>
          import('./pages/catalogs/processors/processors.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/procesadores/create',
        loadComponent: () =>
          import('./pages/catalogs/processors/new-processors-form/new-processors-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/procesadores/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/processors/new-processors-form/new-processors-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/bines',
        loadComponent: () =>
          import('./pages/catalogs/bines/bines.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/bines/create',
        loadComponent: () =>
          import('./pages/catalogs/bines/new-bine-form/new-bine-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/perfil-transaccional',
        loadComponent: () =>
          import('./pages/catalogs/transactional-profiles/transactional-profiles.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/perfil-transaccional/create',
        loadComponent: () =>
          import('./pages/catalogs/transactional-profiles/new-transactional-profile-form/new-transactional-profile-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/perfil-transaccional/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/transactional-profiles/new-transactional-profile-form/new-transactional-profile-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/url-destino',
        loadComponent: () =>
          import('./pages/catalogs/url-target/url-target.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/url-destino/create',
        loadComponent: () =>
          import('./pages/catalogs/url-target/new-url-target-form/new-url-target-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/url-destino/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/url-target/new-url-target-form/new-url-target-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/modo-transaccion',
        loadComponent: () =>
          import('./pages/catalogs/transaction-mode/transaction-mode.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/modo-transaccion/create',
        loadComponent: () =>
          import('./pages/catalogs/transaction-mode/new-transaction-mode-form/new-transaction-mode-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/modo-transaccion/edit/:id',
        loadComponent: () =>
          import('./pages/catalogs/transaction-mode/new-transaction-mode-form/new-transaction-mode-form.component'),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations.component').then(m => m.default),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations/management',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations-management.component').then(m => m.MccOperationsManagementComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations/new',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations-form.component').then(m => m.default),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations/edit/:id',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations-form.component').then(m => m.default),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations/manage/:mccCode',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations-management.component').then(m => m.MccOperationsManagementComponent),
        canActivate: [permissionsGuard]
      },
      {
        path:'catalogos/mcc-operations/view/:mccCode',
        loadComponent: () => import('./pages/catalogs/mcc-operations/mcc-operations-view.component').then(m => m.MccOperationsViewComponent)
      },
      {
        path: 'seguridad',
        loadComponent: () =>
          import('./pages/security/security.component')
            .then(c => c.SecurityComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/security/users/users.component')
            .then(c => c.UsersComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios/create',
        loadComponent: () =>
          import('./pages/security/users/new-user-form/new-user-form.component')
            .then(c => c.NewUserFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios/edit/:id',
        loadComponent: () =>
          import('./pages/security/users/new-user-form/new-user-form.component')
            .then(c => c.NewUserFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios-tdm',
        loadComponent: () =>
          import('./pages/security/users-tdm/users-tdm.component')
            .then(c => c.UsersTDMComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios-tdm/create',
        loadComponent: () =>
          import('./pages/security/users-tdm/new-user-tdm-form/new-user-tdm-form.component')
            .then(c => c.NewUserTDMFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'usuarios-tdm/edit/:id',
        loadComponent: () =>
          import('./pages/security/users-tdm/new-user-tdm-form/new-user-tdm-form.component')
            .then(c => c.NewUserTDMFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'profiles',
        loadComponent: () =>
          import('./pages/security/profiles/profiles.component')
            .then(c => c.ProfilesComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'profiles/create',
        loadComponent: () =>
          import('./pages/security/profiles/new-profile-form/new-profile-form.component')
            .then(c => c.NewProfileFormComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'profiles/edit/:id',
        loadComponent: () =>
          import('./pages/security/profiles/new-profile-form/new-profile-form.component')
            .then(c => c.NewProfileFormComponent),
        canActivate: [permissionsGuard]
        //TODO: CORREGIR ESTA RUTA
      },
      {
        path: 'dispersion',
        loadComponent: () =>
          import('./pages/reports/dispertion/dispertion.component')
            .then(c => c.DispertionComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'estado-cuenta',
        loadComponent: () =>
          import('./pages/reports/statement-account/statement-account.component'),
        canActivate: [permissionsGuard]
      },

      {
        path: 'activities',
        component: ActivityListComponent
      },
      {
        path: 'permissions-manager',
        loadComponent: () =>
          import('./permissions-manager/permissions-manager.component')
            .then(c => c.PermissionsManagementComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'permission-tester',
        loadComponent: () =>
          import('./admin/permission-tester/permission-tester.component')
            .then(c => c.PermissionTesterComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'database-explorer',
        loadComponent: () =>
          import('./pages/admin/database-explorer/database-explorer.component')
            .then(c => c.default),
        canActivate: [adminGuard]
      },
      // MSI Management Routes
      {
        path: 'msi-config',
        loadComponent: () =>
          import('./pages/msi/msi-config/msi-config-page.component')
            .then(c => c.MsiConfigPageComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'msi-bines',
        loadComponent: () =>
          import('./components/msi-bines/msi-bines.component')
            .then(c => c.MsiBinesComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'comercios/:id/msi-config',
        loadComponent: () =>
          import('./pages/msi/merchant-msi-config/merchant-msi-config.component')
            .then(c => c.MerchantMsiConfigComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'operaciones/:id/msi-config',
        loadComponent: () =>
          import('./pages/msi/operations-msi-config/operations-msi-config.component')
            .then(c => c.OperationsMsiConfigComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/msi-bines',
        loadComponent: () =>
          import('./pages/catalogs/msi-bines-catalog/msi-bines-catalog.component')
            .then(c => c.MsiBinesCatalogComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'reportes/msi',
        loadComponent: () =>
          import('./pages/reports/msi-reports/msi-reports.component')
            .then(c => c.MsiReportsComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'catalogos/msi-templates',
        loadComponent: () =>
          import('./pages/catalogs/msi-templates/msi-templates.component')
            .then(c => c.MsiTemplatesComponent),
        canActivate: [permissionsGuard]
      },
      {
        path: 'logout',
        loadComponent: () =>
          import('./shared/components/singout/singout.component')
            .then(c => c.SingoutComponent)
      },
      {
        path:'', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: 'forbidden', loadComponent: () => import('./shared/components/forbidden/forbidden.component').then(c => c.ForbiddenComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
