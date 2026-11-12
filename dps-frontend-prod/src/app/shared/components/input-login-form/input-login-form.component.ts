import { Component, Input } from '@angular/core';
import { TextTypeComponent } from '../text-type/text-type.component';
import { InputLoginComponent } from '../input-login/input-login.component';

@Component({
    selector: 'input-login-form',
    imports: [TextTypeComponent, InputLoginComponent],
    templateUrl: './input-login-form.component.html',
    styleUrl: './input-login-form.component.css'
})
export class InputFormComponent {
  @Input() text: string = '';
  @Input() placeholder: string = '';
}
