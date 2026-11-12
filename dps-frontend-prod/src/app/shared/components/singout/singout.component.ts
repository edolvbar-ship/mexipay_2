import { AuthService } from "@/app/services/auth/auth.service";
import { Component } from '@angular/core';
import { SharedService } from "@/app/services/shared/shared.service";

@Component({
    selector: 'app-singout',
    imports: [],
    templateUrl: './singout.component.html',
    styleUrl: './singout.component.css'
})
export class SingoutComponent {

  constructor(private authService: AuthService, private sharedService: SharedService) {
    this.authService.logout()
    this.sharedService.deleteUserInfo()
    this.sharedService.deleteProfilePermissions()
  }

}
