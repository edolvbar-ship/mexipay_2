import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { TextTitleComponent } from '../text-title/text-title.component';
import { TextTypeComponent } from '../text-type/text-type.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
    selector: 'user-profile-badge',
    imports: [TextTitleComponent, TextTypeComponent, CommonModule],
    templateUrl: './user-profile-badge.component.html',
    styleUrl: './user-profile-badge.component.css'
})
export class UserProfileBadgeComponent implements OnInit{

  constructor(private router: Router) {}

  @Input() name: string = '';
  @Input() userName: string = '';
  @Input() role: string = '';
  @Input() isAdmin: boolean = false;
  @Input() resourceCount: number = 0;

  @Output() accountDetail = new EventEmitter<void>();

  isVisible: boolean = false;

  ngOnInit(): void {

  }

  get capitalName(): string {
    const name = this.name.split(' ');
    const firstLetter = name[0]?.charAt(0).toUpperCase() || '';
    const secondLetter = name[1]?.charAt(0).toUpperCase() || '';
    return `${firstLetter}${secondLetter}`
  }

  switchToggle(){
    this.isVisible = !this.isVisible
  }

  activities(){
    this.router.navigate(['/activities'])
  }
  logOut(){
    this.router.navigate(['/logout'])
  }

  detailAccount() {
    if(this.isVisible) {
      this.isVisible = false
    }
    this.accountDetail.emit();
  }

}
