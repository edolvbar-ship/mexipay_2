import { endpoints } from '@/app/config/endpoints.config';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { AuthService } from '../auth.service';
import { SharedService } from '../../shared/shared.service';

interface Root {
  message: string
  data: Data
  token: string
}

interface Data {
  id: number
  fullName: string
  name: string
  last_name: string
  mail: string
  is_admin: number
  username: string
  telephone: string
  id_profile: number
  id_cliente: number
  signAt: number
  iat: number
  exp: number
}

interface User {
  is_admin: number
  id_profile: number
  id_cliente: number
}

@Injectable({
  providedIn: 'root'
})
export class AuthMeService{

  constructor(private http: HttpClient, private authService: AuthService, private sharedService: SharedService) {
  }

  private API_URL = utils.buildUrl(endpoints.apiV02, `${endpoints.loginUri}/me`);

  get userLogged() {
    return this.authService.isAutenticated()
  }

  getMe(): Observable<Root | null>{
    if (this.userLogged) {
      return this.http.get<Root>(this.API_URL).pipe(
        tap( (response:any) => {
          this.sharedService.shareUserInfo({
            fullName: response.data.fullName,
            mail:response.data.mail,
            userProfile:response.data.id_profile,
            username: response.data.username,
            isAdmin: !!response.data.is_admin,
            idClient: response.data.id,
            telephone: response.data.telephone,
            name: response.data.name,
            last_name: response.data.last_name
          });
          this.authService.storeToken(response.token);
        } ),
      )
    }
    return of(null)
  }

  getCurrentUser(response: Root): User {
    return {
      id_profile: response.data.id_profile,
      id_cliente: response.data.id_cliente,
      is_admin: response.data.is_admin
    };
  }
}
