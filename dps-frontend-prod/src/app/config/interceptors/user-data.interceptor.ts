import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthMeService } from '@/app/services/auth/auth-me/auth-me.service';
import { HttpEvent } from '@angular/common/http';
import { AuthService } from '@/app/services/auth/auth.service';
import { Router } from '@angular/router';

export const userDataInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<any>> => {
  const userService = inject(AuthMeService);
  const isUserLogged = inject(AuthService);
  const router = inject(Router);

  const allowedEndpoints = [
    '/api/v2/users',
    '/api/v2/users/',
  ];

  if(!isUserLogged.isAutenticated()) {
    router.navigate(['/login']); 
    return of()
  } else {
      if ((req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT') && allowedEndpoints.some(endpoint => req.url.includes(endpoint))) {
      return userService.getMe().pipe(
        switchMap((response) => {
          const body = req.body || {};
          const clonedRequest = req.clone({
            body: {
              ...body,
              is_admin: response?.data.is_admin,
            }
          });
          return next(clonedRequest);
        })
      );
    }
    return next(req);
  }
  
};
