import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { AuthService } from '@/app/services/auth/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DefaultButtonComponent } from '@/app/shared/components/default-button/default-button.component';
import { UserInfo } from '@/app/shared/interfaces/user-info.interface';
import { SharedService } from '@/app/services/shared/shared.service';
import { utils } from '@/app/utils/utils';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-login',
    imports: [TextTitleComponent, TextTypeComponent, FormsModule, CommonModule, DefaultButtonComponent ],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  user: string = '';
  password: string = '';
  passwordType: string = 'password';
  textBtn: string = 'Iniciar sesión'
  userInfo: UserInfo | null = null;
  version: string = '0.0.0';

  constructor(private authService: AuthService, private router: Router, private sharedService: SharedService, private toastSrv: ToastrService) {
    this.version = utils.appVersion;
  }

  ngOnInit(): void {
    this.authService.clearSessionExpired();
  }
  login(): void {
    const sha256: string = utils.getSHA256(this.password);
    const passwordNew: string = btoa(sha256);

    this.authService.login(this.user, passwordNew).subscribe({
      next: () => this.loginSuccess(),
      error: (error) => {
        this.loginError(error.message);
      }
    });
  }


  loginSuccess() {
    this.userInfo = this.authService.userInfo;
    this.router.navigate(['/dashboard']);
    this.sendUserInfo()
  }

  loginError(error: string) {
    this.toastSrv.error(error)
  }

  sendUserInfo() {
    if (this.userInfo) {
      this.sharedService.shareUserInfo(this.userInfo);
    } else {
      this.toastSrv.error('Usuario o contraseña inválidos')
    }
  }

  passVisibility() {
    this.passwordType = this.passwordType === 'password' ? 'text' : 'password';
  }
}