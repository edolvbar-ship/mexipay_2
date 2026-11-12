import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UserProfileBadgeComponent } from '../user-profile-badge/user-profile-badge.component';
import { HeaderLogoComponent } from '../header-logo/header-logo.component';
import { CommonModule } from '@angular/common';
import { UserInfo } from '../../interfaces/user-info.interface';
import { Subscription } from 'rxjs';
import { SharedService } from '@/app/services/shared/shared.service';
import { HeaderGreetingComponent } from '../header-greeting/header-greeting.component';
import { AuthMeService } from '@/app/services/auth/auth-me/auth-me.service';

@Component({
    selector: 'app-header',
    imports: [UserProfileBadgeComponent, HeaderLogoComponent, CommonModule, HeaderGreetingComponent],
    templateUrl: './header.component.html',
    styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {

  constructor(
    private sharedService: SharedService,
    private authMeService: AuthMeService,
  ) {}

  private subUserInfo: Subscription | undefined;
  userInfo: UserInfo | null = null;
  @Input()isUserInfoVisible: boolean = false
  @Output() accountDetail = new EventEmitter<void>();

  ngOnInit(): void {
    this.subUserInfo = this.sharedService.userInfo$.subscribe(data => {
      this.userInfo = data;
    });
  }


  ngOnDestroy(): void {
    if (this.subUserInfo) {
      this.subUserInfo.unsubscribe();
    }
  }

  get userFullName(): string {
    if(!this.userInfo) {
      return ''
    } else {
      return this.userInfo.fullName;
    }
  }

  get userName(): string {
    if(!this.userInfo) {
      return ''
    } else {
      if(this.userInfo.username) {
        return this.userInfo.username;
      } else
        return '';
    }
  }

  get isUserAdmin(): boolean {
    return this.userInfo?.isAdmin ?? false;
  }

  get userRole(): string {
    // Get the profile name from the permissions data - this is the entity that resources are associated with
    const permissions = this.sharedService.currentPermissions;
    if (permissions && permissions.length > 0) {
      // All permissions for a user have the same profile_name, so take the first one
      const firstPermission = permissions[0];
      if (firstPermission.profile_name) {
        return firstPermission.profile_name;
      }
    }
    // Fallback to profile ID if no permissions loaded yet
    return this.userInfo?.userProfile ? `Perfil ${this.userInfo.userProfile}` : '';
  }

  get userResourceCount(): number {
    // Get the count of resources the user has access to
    const permissions = this.sharedService.currentPermissions;
    if (this.userInfo?.isAdmin) {
      // Admins typically have access to all resources
      return permissions.length > 0 ? permissions.length : 999;
    }
    // Count resources with select permission
    return permissions.filter((p: any) => p.select === 1).length;
  }

  getDetail() {
    this.accountDetail.emit()
  }

}
