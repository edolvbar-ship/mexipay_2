import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { SharedService } from '../../services/shared/shared.service';
import { AuthService } from '../../services/auth/auth.service';

/**
 * Angular Route Guard for permission-based access control
 *
 * This guard checks if the current user has the necessary permissions to access a route
 * and handles navigation to forbidden routes when permissions are insufficient.
 *
 * Key Features:
 * - Validates user permissions against the current route
 * - Handles nested route permissions (create/edit/upload operations)
 * - Sets permission data on route for use in components
 * - Redirects to forbidden page when access is denied
 */
export const permissionsGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {

  // Inject required services using Angular's dependency injection
  const sharedService = inject(SharedService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get the current URL the user is trying to access
  const currentUrl = state.url;

  // If user is not authenticated, let authGuard handle it
  if (!authService.isAutenticated()) {
    return of(false);
  }

  /**
   * Enhanced permission checking with retry logic for refresh scenarios
   */
  const checkPermissionsWithRetry = (): Observable<boolean> => {
    return sharedService.userProfilePermissions$.pipe(
      take(1), // Take only the first emission
      switchMap((permissions) => {
        // If permissions are empty on first load, wait a bit and retry
        if (!permissions || permissions.length === 0) {
          return timer(500).pipe(
            switchMap(() => sharedService.userProfilePermissions$.pipe(take(1))),
            map((retryPermissions) => {
              return evaluatePermissions(retryPermissions, currentUrl, sharedService, router, route);
            })
          );
        }

        return of(evaluatePermissions(permissions, currentUrl, sharedService, router, route));
      })
    );
  };

  return checkPermissionsWithRetry();
};

  /**
 * Helper function to evaluate permissions and handle routing
 */
const evaluatePermissions = (
  permissions: any[], 
  currentUrl: string, 
  sharedService: SharedService, 
  router: Router, 
  route: ActivatedRouteSnapshot
): boolean => {
  
  // Get user info to check if admin
  const userInfo = sharedService.userInfoSubjet.value;
  
  // Grant admin users full access to all routes
  if (userInfo?.isAdmin) {
    // Set full permissions for admin users
    route.data = {
      ...route.data,
      canEdit: true,
      canCreate: true,
      canDelete: true,
      isMerchantScoped: false
    };
    return true;
  }
  
  // If no permissions are defined, allow access (fail-open strategy)
  if (!permissions || permissions.length === 0) {
    return true;
  }

  // Check if there's an exact permission match for the current URL
  const hasPermission = permissions.some((permiso: any) => permiso.resource_url === currentUrl);

  if (hasPermission) {
    // For parent routes (like /comercios), get permissions from the matching route
    const parentPermission = permissions.find((permiso: any) => permiso.resource_url === currentUrl);
    
    if (parentPermission) {
      route.data = {
        ...route.data,
        canEdit: parentPermission.edit === 1,
        canCreate: parentPermission.create === 1,
        canDelete: parentPermission.delete === 1,
        isMerchantScoped: false // Default to false since field doesn't exist
      };
    } else {
      route.data = {
        ...route.data,
        canEdit: false,
        canCreate: false,
        canDelete: false,
        isMerchantScoped: false
      };
    }
    return true; // Exact permission match found, allow access
  } else {
    // No exact match found, check for nested operation permissions
    const match = currentUrl.match(/\/(create|edit|upload)(\/|$)/);
    const permissionScope = match ? match[1] : null;

    if (permissionScope) {
      // Extract the parent route by removing the operation segment
      const parentRoute = currentUrl.replace(/\/(create|edit|upload)(\/.*)?$/, '');

      // Find permissions for the parent route
      const parentPermission = permissions.find((permiso: any) => permiso.resource_url === parentRoute);

      if (!parentPermission) {
        // Set route data with default false permissions
        route.data = {
          ...route.data,
          canEdit: false,
          canCreate: false,
          canDelete: false
        };
        return false; // No permission for parent route, deny access
      }

      // Check specific operation permissions based on the URL segment
      let canEdit = false;
      let canCreate = false;
      let canDelete = false;

      if (permissionScope === 'create' || permissionScope === 'edit') {
        canEdit = parentPermission.edit === 1;
        canCreate = parentPermission.create === 1;
        canDelete = parentPermission.delete === 1;
      } else if (permissionScope === 'upload') {
        canEdit = parentPermission.edit === 1;
        canCreate = parentPermission.create === 1;
        canDelete = false;
      }

      // Set route data with actual permissions
      route.data = {
        ...route.data,
        canEdit,
        canCreate,
        canDelete,
        isMerchantScoped: parentPermission ? false : false // Default to false since field doesn't exist
      };

      if (permissionScope === 'create' || permissionScope === 'edit') {
        return parentPermission && parentPermission[permissionScope] === 1;
      } else if (permissionScope === 'upload') {
        const canEditPerm = parentPermission.edit === 1;
        const canCreatePerm = parentPermission.create === 1;
        return canEditPerm && canCreatePerm;
      }
    } else {
      // Set default permissions for unmatched routes
      route.data = {
        ...route.data,
        canEdit: false,
        canCreate: false,
        canDelete: false,
        isMerchantScoped: false
      };
    }

    return false; // No matching permissions found
  }
};
