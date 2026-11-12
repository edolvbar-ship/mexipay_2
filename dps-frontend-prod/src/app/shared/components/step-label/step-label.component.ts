import { Component, Input } from '@angular/core';
import { TextTitleComponent } from '../text-title/text-title.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-step-label',
    imports: [TextTitleComponent, CommonModule],
    templateUrl: './step-label.component.html',
    styleUrl: './step-label.component.css'
})
export class StepLabelComponent {

  @Input() step: string = '0';
  @Input() label: string = 'Label'
  @Input() status: 'default' | 'disabled' | 'success' | 'error' = 'default';


  get labelVariant() {
    switch(this.status){
      case 'default':
        return 'secondary';
      case 'disabled':
        return 'disable';
      default:
        return 'primary';
    }
  }


}
