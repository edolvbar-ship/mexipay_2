import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'header-logo',
    imports: [RouterLink],
    templateUrl: './header-logo.component.html',
    styleUrl: './header-logo.component.css'
})
export class HeaderLogoComponent {
}
