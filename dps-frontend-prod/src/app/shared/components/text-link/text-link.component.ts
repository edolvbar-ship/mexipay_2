import { CommonModule } from '@angular/common';
import { Component, Input} from '@angular/core';

@Component({
    selector: 'app-text-link',
    imports: [CommonModule],
    templateUrl: './text-link.component.html',
    styleUrl: './text-link.component.css'
})
export class TextLinkComponent {

  @Input() link: string = '';
  @Input() text: string = '';
}
