import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common'

@Component({
    selector: 'input-login',
    imports: [CommonModule],
    templateUrl: './input-login.component.html',
    styleUrl: './input-login.component.css'
})
export class InputLoginComponent {
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() type: string = 'text';
  @Input() id: string = '';
  @Input() placeholder: string = '';
  @Input() src: string = '';
  @Input() secondarySrc: string = '';
}
