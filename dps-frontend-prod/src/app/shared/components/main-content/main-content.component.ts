import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpinnerComponent } from '../spinner/spinner.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'main-content',
    imports: [RouterOutlet, SpinnerComponent, CommonModule],
    templateUrl: './main-content.component.html',
    styleUrl: './main-content.component.css'
})
export class MainContentComponent {

  isLoading = false;

}
