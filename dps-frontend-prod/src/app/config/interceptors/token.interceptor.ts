import { AuthService } from "@/app/services/auth/auth.service";
import { HttpEvent, HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, Observable, of, switchMap, throwError } from "rxjs";
import { endpoints } from '@/app/config/endpoints.config';
import { Router } from "@angular/router";
import { AuthMeService } from "@/app/services/auth/auth-me/auth-me.service";
import { ToastrService } from "ngx-toastr";

export const tokenInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
    const authService = inject(AuthService);
    const userService = inject(AuthMeService);

    if(req.url.includes(`${endpoints.loginUri}`)){
        return next(req);
    }

    const token = authService.getToken();
    if(!token) {
        return next(req);
    }
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiration = payload.exp * 1000;

    if(Date.now() < (expiration - (60 * 1000))) {
        return next(req);
    }


    return userService.getMe().pipe(
        switchMap((response) => {
            if(response){
                authService.storeToken(response.token);
                return next(req);
            }else{
                authService.expireSession();
                return next(req);
            }
        })
      );
};
