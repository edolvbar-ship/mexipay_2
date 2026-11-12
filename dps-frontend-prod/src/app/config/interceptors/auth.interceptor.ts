import { AuthService } from "@/app/services/auth/auth.service";
import { HttpEvent, HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandler } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, Observable, throwError } from "rxjs";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";

// Helper function to handle redirects and cleanup
const handleAuthError = (
  error: HttpErrorResponse,
  authService: AuthService,
  toastrService: ToastrService,
  router: Router,
  req: HttpRequest<any>
) => {
  const returnUrl = router.routerState.snapshot.url;
  const wasAuthenticated = authService.isAutenticated();
  
  // Debug logging for database explorer
  const isDbExplorer = req.url.includes('database-explorer');
  if (isDbExplorer) {
    console.log('[Auth Error Handler] Error status:', error.status);
    console.log('[Auth Error Handler] Error message:', error.error?.message);
    console.log('[Auth Error Handler] Was authenticated:', wasAuthenticated);
  }
  
  // Check if this is a real auth error (token/jwt issue) vs permission error
  // Only treat 403 as auth error if message mentions token/jwt/auth (but not "administrador")
  const errorMessage = error.error?.message || '';
  const isTokenRelated = errorMessage.match(/(token|jwt)/i);
  const isAuthRelated = errorMessage.match(/authorization/i) && !errorMessage.match(/administrador/i);
  
  const isAuthError = error.status === 401 || 
                    (error.status === 403 && (isTokenRelated || isAuthRelated)) ||
                    (error.status === 500 && errorMessage.match(/(token|jwt|authorization|session)/i));

  if (isDbExplorer) {
    console.log('[Auth Error Handler] isTokenRelated:', !!isTokenRelated);
    console.log('[Auth Error Handler] isAuthRelated:', !!isAuthRelated);
    console.log('[Auth Error Handler] isAuthError:', isAuthError);
  }

  // If it's a real auth error (invalid token/expired session) and user was authenticated, handle logout
  if (isAuthError && wasAuthenticated) {
    let message = 'Tu sesión ha expirado o es inválida. Por favor, inicia sesión nuevamente.';
    
    if (error.status === 403) {
      message = 'No tienes permisos para acceder a este recurso.';
    } else if (error.status === 500) {
      message = 'Error de autenticación. Por favor, inténtalo de nuevo.';
    }
    
    if (isDbExplorer) {
      console.log('[Auth Error Handler] Logging out due to auth error');
    }
    
    toastrService.warning(message);
    authService.logout();
    router.navigate(['/login'], { queryParams: { returnUrl } });
    return true;
  }
  
  // For permission errors (403 without token issues), just show error without logout
  if (error.status === 403) {
    if (isDbExplorer) {
      console.log('[Auth Error Handler] Permission error - not logging out');
    }
    toastrService.error('No tienes permisos para acceder a este recurso.');
    return true;
  }
  
  // For non-authenticated users or non-auth errors, just show the error
  if (error.status === 401) {
    toastrService.error('Por favor, inicia sesión para continuar');
    return true;
  }
  
  if (error.status === 500) {
    toastrService.error('Error del servidor. Por favor, inténtalo de nuevo más tarde.');
    return true;
  }
  
  if (error.status === 0) {
    toastrService.error('No se pudo establecer conexión. Por favor, revisa tu red.');
    return true;
  }

  return false;
};

export const authInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const toastrService = inject(ToastrService);
  const router = inject(Router);

  const token = authService.getToken();
  
  // Log database explorer requests for debugging
  const isDbExplorer = req.url.includes('database-explorer');
  if (isDbExplorer) {
    console.log('[Auth Interceptor] Database Explorer request:', req.method, req.url);
    console.log('[Auth Interceptor] Token present:', !!token);
  }
  
  // Skip auth check for these paths
  const publicPaths = ['/auth/', '/login', '/register', '/forgot-password', '/', '/get-info', '/gateway/api/v2/profiles', '/gateway/api/v2/auth/me'];
  const isPublicPath = publicPaths.some(path => req.url.includes(path));

  // Add auth header if token exists
  if (token) {
    if (isDbExplorer) {
      console.log('[Auth Interceptor] Adding Bearer token to request');
    }
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    return next(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Special logging for database explorer errors
        if (isDbExplorer) {
          console.error('[Auth Interceptor] Database Explorer API Error:', {
            status: error.status,
            url: error.url,
            message: error.message,
            error: error.error
          });
        }
        
        console.error('🔐 API Error:', {
          status: error.status,
          url: error.url,
          message: error.message,
          error: error.error
        });

        // Handle known error cases
        const isHandled = handleAuthError(error, authService, toastrService, router, req);
        
        // For unhandled errors, log them and show a generic message
        if (!isHandled) {
          console.error('Unhandled API Error:', error);
          toastrService.error('Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
        }

        return throwError(() => error);
      })
    );
  } else {
    // No token found
  }

  // For public paths, just continue without token
  if (isPublicPath) {
    return next(req);
  }

  // For non-public paths without token, just continue and let the server handle it
  // We don't redirect here to prevent login loops
  return next(req);
};
