import { NewAuthService } from '@/app/services/auth/new-auth/new-auth.service';
import { DefaultButtonComponent } from '@/app/shared/components/default-button/default-button.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { AuthCreateNewPassResponse } from '@/app/shared/interfaces/auth-reset.interface';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { utils } from '@/app/utils/utils';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-generate-password',
    imports: [TextTypeComponent, TextTitleComponent, DefaultButtonComponent, FormsModule ],
    templateUrl: './generate-password.component.html',
    styleUrl: './generate-password.component.css'
})
export class GeneratePasswordComponent implements OnInit{

  token: string = '';
  type: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  password: string = '';
  passwordTypeNew: string = 'password';
  passwordTypeConfirm: string = 'password';
  version: string = '0.0.0';


  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['tkn'];
      this.type = params['type'];
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private newAuthService: NewAuthService,
    private toastSrv: ToastrService 
  ) {
    this.version = utils.appVersion;
  }

  togglePasswordVisibility(propertie: number): void {
    if(propertie > 1) {
      this.passwordTypeConfirm = this.passwordTypeConfirm === 'password' ? 'text' : 'password';
    } else {
      this.passwordTypeNew = this.passwordTypeNew === 'password' ? 'text' : 'password';
    }
  }  

  resetPassword(): void {
    this.newAuthService.postNewPassword(this.token, this.type, this.password).subscribe({
      next: (response) => this.navigateLogin(response),
      error: (err) => this.toastSrv.error('Error en autenticación')
    })
  }

  navigateLogin(response: AuthCreateNewPassResponse):void {
    this.toastSrv.success('Contraseña actualizada con éxito. Puedes iniciar sesión.')
    this.router.navigate(['/']);
  }

  async validatePassword(): Promise<void> {
    if (this.newPassword === this.confirmPassword) {
      try {
        this.password = await this.encryptPassword(this.newPassword);
        this.resetPassword()
      } catch (error) {
        console.error('Error en el cifrado:', error);
        this.toastSrv.error('Ha ocurrido un error. Por favor vuelve a intentar.')
      }
    } else {
      this.toastSrv.error('Las contraseñas no coinciden.')
    }
  }
  

  encryptPassword(password: string):string {
    const sha256: string = utils.getSHA256(password)
    const b64: string = btoa(sha256)
    return b64
  }

}