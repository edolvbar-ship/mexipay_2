import { Component, Input } from '@angular/core';
import { TextTypeComponent } from '../text-type/text-type.component';

@Component({
    selector: 'default-button',
    imports: [TextTypeComponent],
    templateUrl: './default-button.component.html',
    styleUrl: './default-button.component.css'
})
export class DefaultButtonComponent {

  @Input() text: string = ''

}
