import { Component, OnInit, Self } from '@angular/core';
import { InputTextComponent } from '../input-text/input-text.component';
import { ControlValueAccessor, FormsModule, NgControl } from '@angular/forms';
import { NgxMaskService, provideNgxMask } from 'ngx-mask';
import { ErrorMessageService } from '@/app/services/shared/error-message/error-message.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-input-textarea',
    imports: [FormsModule, CommonModule],
    templateUrl: './input-textarea.component.html',
    styleUrl: './input-textarea.component.css',
    providers: [
        provideNgxMask()
    ]
})
export class InputTextareaComponent extends InputTextComponent implements ControlValueAccessor, OnInit {
  

  constructor(@Self() ngControl: NgControl, maskService: NgxMaskService, errorMsgService: ErrorMessageService){
    super(ngControl, maskService,errorMsgService);
  }

}
