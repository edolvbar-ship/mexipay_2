import { Component, Input } from '@angular/core';
import { CardContainerComponent } from '../card-container/card-container.component';
import { TextTitleComponent } from '../text-title/text-title.component';

@Component({
    selector: 'form-card',
    imports: [CardContainerComponent, TextTitleComponent],
    templateUrl: './form-card.component.html',
    styleUrl: './form-card.component.css'
})
export class FormCardComponent {

  @Input() title: string = ''
  @Input() number: string = ''

} 
