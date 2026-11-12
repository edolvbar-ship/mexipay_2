import { ErrorMessageService } from '@/app/services/shared/error-message/error-message.service';
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Self } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormsModule, NgControl, Validators } from '@angular/forms';
import { NgxMaskService, provideNgxMask } from 'ngx-mask';

@Component({
    selector: 'app-input-text',
    imports: [FormsModule, CommonModule],
    templateUrl: './input-text.component.html',
    styleUrl: './input-text.component.css',
    providers: [
        provideNgxMask()
    ]
})
export class InputTextComponent implements ControlValueAccessor, OnInit{

  value: string = '';
  prevValue: string = '';
  isPassword: boolean = false;

  allowedRegExp?: RegExp;

  control!: AbstractControl | null;

  isFocused: boolean = false;

  ngControl: NgControl;

  @Input() type: 'text'|'password'|'number'|'date' = 'text';
  @Input() pattern: string | RegExp = '';
  @Input() min: string = '';
  @Input() max: string = '';
  @Input() step: string = '';
  @Input() required: string | boolean = false;
  @Input() disabled: string | boolean = false;
  @Input() minlength:string | number = 0;
  @Input() maxlength:string | number = 100;

  @Input() allowedPattern: string | RegExp = '';
  @Input() mask: string = '';
  @Input() prefix: string = '';
  @Input() suffix: string = '';
  @Input('masked') useMaskedValue: boolean = false;

  @Input() thousandSeparator:string = ',';
  @Input() decimalMarker:"." | "," | [".", ","] = '.';

  @Input() label?: string;
  @Input() placeholder?: string = '';
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() upper:string | boolean = false;


  constructor(@Self() ngControl: NgControl, private maskService: NgxMaskService, private errorMsgService: ErrorMessageService){
      this.ngControl = ngControl;
      this.ngControl.valueAccessor = this;

  }

  ngOnInit(): void {
    this.control = this.ngControl.control;
    this.required = (this.required || this.required === '') || (this.control?.hasValidator(Validators.required) || false);
    this.isPassword = this.type == 'password';
    this.upper = this.upper || this.upper === '';
    if(this.allowedPattern && typeof this.allowedPattern == 'string') {
      this.allowedRegExp = new RegExp(this.allowedPattern);
    }else if(this.allowedPattern instanceof RegExp){
      this.allowedRegExp = new RegExp(this.allowedPattern);
    }

    this.maskService.thousandSeparator = this.thousandSeparator;
    this.maskService.decimalMarker = this.decimalMarker;
    this.maskService.suffix = this.suffix;
    this.maskService.prefix = this.prefix;
    this.maskService.maskExpression = this.mask;

  }


  onChange = (value: string) => {};
  onTouched = () => {};

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = this.value;

    if(event instanceof InputEvent){

      if(this.mask) {
        if(event.inputType !== 'deleteContentBackward'){
          input.value = this.maskService.applyMask(input.value, this.mask);
        }
        if(this.useMaskedValue){
          value = input.value;
        }else {
          value = this.maskService.removeMask(value);
        }
      }

      if(event.inputType === 'insertFromPaste'){
        if(!this.mask){
          input.value = value = this.removeNotAllowed(input.value); 
        }else {
          value = this.removeNotAllowed(this.maskService.removeMask(input.value)); 
        }
      }else if(!this.allowedRegExp || event.inputType === 'deleteContentBackward' || (event.data && this.allowedRegExp.test(event.data))) {
        if(this.mask && !this.useMaskedValue) {
          value = this.maskService.removeMask(input.value);
        }else {
          value = input.value;
        }
      }else {
        input.value = value = this.prevValue;
      }
    }

      value = value;
      input.value = value;

      if(this.upper) {
        value = value.toUpperCase();
        input.value = input.value.toUpperCase();
      }

      this.prevValue = value.trim();
      this.onChange(value.trim());
    
  }

  onBlur(event: Event) {
    this.isFocused = false;
    const input = event.target as HTMLInputElement;
    if(this.mask){
      input.value = this.maskService.hideInput(input.value, this.mask);
    }
    this.onTouched();
  }

  onFocus(event: Event){
    this.isFocused = true;
    const input = event.target as HTMLInputElement;
    if(this.mask){
      input.value = this.maskService.applyMask(this.value, this.mask);
    }
  }

  toogleType(){
    if(this.type == 'password'){
      this.type = 'text';
    }else {
      this.type = 'password';
    }
  }

  writeValue(value: any): void {
    this.prevValue = value;
    if(this.mask && value){
      this.maskService.thousandSeparator = this.thousandSeparator;
      this.maskService.decimalMarker = this.decimalMarker;
      this.maskService.suffix = this.suffix;
      this.maskService.prefix = this.prefix;
      this.value = this.maskService.applyMask(value, this.mask);
    }else {
      this.value = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.required = !isDisabled && ((this.required || this.required === '') || (this.control?.hasValidator(Validators.required) || false));
    this.disabled = isDisabled;
  }

  isInvalid(): boolean {
    return !this.isFocused && ((this.control?.invalid && (this.control.touched || this.control.dirty) ) || false)
  }

  isValid():boolean {
    return (this.control?.valid && (this.control.touched || this.control.dirty) ) || false
  }

  getError(control: AbstractControl | null): string {
    return this.errorMsgService.getErrorMessage(control) || '&nbsp;';
  }

  removeNotAllowed(inputValue: string): string {
    const allowedChars = inputValue.split('').filter(char => (this.allowedRegExp?.test(char) ?? true));
    return allowedChars.join('');
  }

}
