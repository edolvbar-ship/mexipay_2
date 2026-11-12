import { SpinnerService } from '@/app/services/shared/spinner/spinner.service';
import { Component, inject } from '@angular/core';

@Component({
    selector: 'app-spinner',
    imports: [],
    templateUrl: './spinner.component.html',
    styleUrl: './spinner.component.css'
})
export class SpinnerComponent {

  private spinnerService = inject(SpinnerService)
  isloading = this.spinnerService.isLoading;
  
}
