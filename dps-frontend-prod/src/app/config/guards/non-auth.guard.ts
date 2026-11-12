import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '@/app/services/auth/auth.service'
import { Router } from '@angular/router';

export const nonAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAutenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
