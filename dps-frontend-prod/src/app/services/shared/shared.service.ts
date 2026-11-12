import { UserInfo } from '@/app/shared/interfaces/user-info.interface';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class SharedService {

  constructor(private authService: AuthService) { 
    this.initializeSession();
  }

  private initializeSession(): void {
    // Restore user info from localStorage if it exists
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        this.userInfoSubjet.next(parsedUserInfo);
      } catch (error) {
        console.error('Failed to parse user info from localStorage', error);
        localStorage.removeItem('userInfo');
      }
    }
  }

  public userInfoSubjet = new BehaviorSubject<UserInfo | null>(null);
  public readonly userInfo$ = this.userInfoSubjet.asObservable();

  private userProfilePermissionsSubject = new BehaviorSubject<any[]>(this.getProfilePermissionsFromLocalStorage());
  public readonly userProfilePermissions$ = this.userProfilePermissionsSubject.asObservable();

  shareUserInfo(data: UserInfo) {
    this.userInfoSubjet.next(data);
    // Persist user info to localStorage for session recovery
    localStorage.setItem('userInfo', JSON.stringify(data));
  }

  deleteUserInfo() {
    this.userInfoSubjet.next(null);
    localStorage.removeItem('userInfo');
  }

  shareProfilePermissions( data: any){
    this.userProfilePermissionsSubject.next(data)
    this.saveProfilePermissionsToLocalStorage(data);
  }

  deleteProfilePermissions(){
    this.userProfilePermissionsSubject.next([])
    localStorage.removeItem('userProfilePermissions'); 
  }

  private saveProfilePermissionsToLocalStorage(data: any[]) {
    localStorage.setItem('userProfilePermissions', JSON.stringify(data));
  }
  private getProfilePermissionsFromLocalStorage(): any[] {
    const permissions = localStorage.getItem('userProfilePermissions');
    return permissions ? JSON.parse(permissions) : [];
  }

  hasPermission(resourceName: string): boolean {
    // Grant admins access to all resources
    const userInfo = this.userInfoSubjet.value;
    if (userInfo?.isAdmin) {
      return true;
    }
    
    const permissions = this.userProfilePermissionsSubject.value;
    return permissions.some((permission: any) => 
      (permission.resource_name === resourceName || permission.resource_url === resourceName) && permission.select === 1
    );
  }

  // Public getter for current permissions (for menu component)
  get currentPermissions(): any[] {
    return this.userProfilePermissionsSubject.value;
  }
}
