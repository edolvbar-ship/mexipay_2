import { ErrorMessageService } from '@/app/services/shared/error-message/error-message.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, Self } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormsModule, NgControl, Validators } from '@angular/forms';

@Component({
    selector: 'app-input-select',
    imports: [FormsModule, CommonModule],
    templateUrl: './input-select.component.html',
    styleUrl: './input-select.component.css'
})
export class InputSelectComponent implements ControlValueAccessor, OnInit{

  @Input() label?: string;
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() required: string | boolean = false;
  @Input() disabled: string | boolean = false;
  @Input() options: {[key: string]: any} = {};

  @Output() change: EventEmitter<{[key: string]: any}> = new EventEmitter();

  value: any;
  control!: AbstractControl | null;
  isFocused: boolean = false;

  constructor(@Self() private ngControl: NgControl, private errorMsgService: ErrorMessageService) {
    this.ngControl.valueAccessor = this;
  }

  ngOnInit(): void {
    this.control = this.ngControl.control;
    this.required = (this.required || this.required === '') || (this.control?.hasValidator(Validators.required) || false);
  }


  onInput(event: Event) {
    const input = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(input.selectedOptions);

    this.change.emit(selectedOptions.reduce((obj:{[key: string]: any}, option) => {
      obj[option.text] = option.value;
      return obj;
    }, {})); 
    this.onChange(this.value);
    this.onTouched();
  }

  isInvalid(): boolean {
    return !this.isFocused && ((this.control?.invalid && (this.control.touched || this.control.dirty) ) || false)
  }

  onBlur(event: Event) {
    this.isFocused = false;
    this.onTouched();
  }

  onFocus(event: Event){
    this.isFocused = true;
  }

  getError(control: AbstractControl | null): string {
    return this.errorMsgService.getErrorMessage(control) || '&nbsp;';
  }


  onChange(value: any){}
  onTouched(){}

  writeValue(value: any): void {
    this.value = value ?? '';
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

}
