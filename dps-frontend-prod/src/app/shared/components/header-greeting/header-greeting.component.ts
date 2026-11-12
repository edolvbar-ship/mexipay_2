import { Component, Input } from '@angular/core';
import { TextTypeComponent } from '../text-type/text-type.component';

@Component({
    selector: 'header-greeting',
    imports: [TextTypeComponent],
    templateUrl: './header-greeting.component.html',
    styleUrl: './header-greeting.component.css'
})
export class HeaderGreetingComponent {
  @Input() name: string = '';

  get firstName():string {
    return this.name.split(' ')[0];
  }
}
