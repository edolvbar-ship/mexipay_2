import { Component } from '@angular/core';
import { HeaderComponent } from "../header/header.component";
import { MainContentComponent } from "../main-content/main-content.component";
import { FooterComponent } from '../footer/footer.component';

@Component({
    selector: 'app-non-layout',
    imports: [HeaderComponent, MainContentComponent, FooterComponent],
    templateUrl: './non-layout.component.html',
    styleUrl: './non-layout.component.css'
})
export  class NonLayoutComponent {

}
