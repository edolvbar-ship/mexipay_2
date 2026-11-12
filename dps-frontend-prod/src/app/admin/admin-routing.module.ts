import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsManagementComponent } from './permissions-management/permissions-management.component';
import { PermissionTesterComponent } from './permission-tester/permission-tester.component';
import { PermissionsGuard } from '../config/guards/permissions.guard';

const routes: Routes = [
  { path: 'permissions', component: PermissionsManagementComponent, canActivate: [PermissionsGuard] },
  { path: 'permission-tester', component: PermissionTesterComponent, canActivate: [PermissionsGuard] }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
