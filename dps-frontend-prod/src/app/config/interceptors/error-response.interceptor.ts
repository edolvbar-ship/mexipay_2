import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { catchError, throwError } from "rxjs";

export const ErrorResponseInterceptor: HttpInterceptorFn = (req, next) =>
    next(req).pipe(catchError(handleError));

function handleError(error: HttpErrorResponse) {
    const errorResponse = `Error ${error.status} ${error.message}, message: ${error.error.text}`;
    return throwError(() => errorResponse)
}