import { AuthService } from "@/app/services/auth/auth.service";
import { SpinnerService } from "@/app/services/shared/spinner/spinner.service";
import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { finalize, catchError, throwError, of } from "rxjs";

export const spinnerInterceptor: HttpInterceptorFn = (req, next) => {
  const spinnerService = inject(SpinnerService);
  const isUserLogged = inject(AuthService);
  spinnerService.show();

  if(isUserLogged) {
    return next(req).pipe(
    catchError(error => {
      return throwError(() => error); 
    }),
    finalize(() => spinnerService.hide()) 
  ); } else {
    return of()
  }
  
};
