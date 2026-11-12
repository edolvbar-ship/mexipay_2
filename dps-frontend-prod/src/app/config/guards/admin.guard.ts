import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '@/app/services/auth/auth.service';

/**
 * Admin Guard
 * 
 * Protects routes that require admin privileges.
 * Checks if the authenticated user has is_admin flag set to true.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  console.log('[Admin Guard] Checking access to:', state.url);
  console.log('[Admin Guard] isAutenticated():', authService.isAutenticated());
  console.log('[Admin Guard] Token:', authService.getToken()?.substring(0, 20) + '...');

  // Check if user is authenticated
  if (!authService.isAutenticated()) {
    console.log('[Admin Guard] Not authenticated - redirecting to login');
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Check if user is admin
  const userInfo = authService.userInfo;
  console.log('[Admin Guard] userInfo:', userInfo);
  console.log('[Admin Guard] userInfo.isAdmin:', userInfo?.isAdmin);
  
  if (!userInfo || !userInfo.isAdmin) {
    console.log('[Admin Guard] Not admin - redirecting to forbidden');
    toastr.error('Acceso denegado. Se requieren privilegios de administrador.', 'Error de permisos');
    router.navigate(['/forbidden']);
    return false;
  }

  console.log('[Admin Guard] Access granted');
  return true;
};
