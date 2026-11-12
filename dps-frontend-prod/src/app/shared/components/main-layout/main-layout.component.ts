import { Component } from '@angular/core';
import { MenuSidebarComponent } from '../menu-sidebar/menu-sidebar.component';
import { MainContentComponent } from '../main-content/main-content.component';
import { HeaderComponent } from '../header/header.component';
import { RouterOutlet } from '@angular/router';
import { SpinnerComponent } from "../spinner/spinner.component";
import { ProfileModalComponent } from "../../../pages/profile-modal/profile-modal.component";

@Component({
    selector: 'app-main-layout',
    imports: [MenuSidebarComponent, MainContentComponent, HeaderComponent, ProfileModalComponent],
    templateUrl: './main-layout.component.html',
    styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent {

  isVisible: boolean = false;

  getDetail(){
    this.isVisible = !this.isVisible;
  }
}
