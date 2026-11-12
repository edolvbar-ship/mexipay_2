import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ActivityListComponent } from './activity-list/activity-list.component';
import {PaymentComponent} from "@/app/services/payments/payment.component";

const routes: Routes = [
  { path: 'payment', component: PaymentComponent },
  { path: 'activities', component: ActivityListComponent },
  { path: '', redirectTo: '/activities', pathMatch: 'full' },
  { path: '**', redirectTo: '/activities' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
