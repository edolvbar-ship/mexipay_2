import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TextTitleComponent } from '../../shared/components/text-title/text-title.component';
import { TextTypeComponent } from '../../shared/components/text-type/text-type.component';
import { DefaultButtonComponent } from '../../shared/components/default-button/default-button.component';
import { FormsModule } from '@angular/forms';
import { AuthResetService } from '@/app/services/auth/auth-reset/auth-reset.service';
import { ToastrService } from 'ngx-toastr';
import { utils } from '@/app/utils/utils';

@Component({
    selector: 'app-recovery-password',
    imports: [RouterLink, TextTitleComponent, TextTypeComponent, DefaultButtonComponent, FormsModule],
    templateUrl: './recovery-password.component.html',
    styleUrl: './recovery-password.component.css'
})
export class RecoveryPasswordComponent {

  constructor (private resetAuth: AuthResetService, private router: Router, private toastSrv: ToastrService) {
    this.version = utils.appVersion;
  }

  user: string = '';
  version: string = '0.0.0';

  getPassword(): void {
    if (!this.user) {
    } else {
      this.resetAuth.postPassword(this.user).subscribe(
      {
        next: () => this.successResponse(),
        error: () => this.errorResponse()
      });
    }
  }

  successResponse(): void {
    this.toastSrv.success('Te hemos enviado un correo electrónico con los pasos a seguir.')
    this.router.navigate(['/']);
  }

  errorResponse(): void {
    this.toastSrv.error('Usuario inválido, vuelve a intentar.')
  }
}
