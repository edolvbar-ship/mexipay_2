import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'text-type',
    imports: [CommonModule],
    templateUrl: './text-type.component.html',
    styleUrl: './text-type.component.css'
})
export class TextTypeComponent {
  @Input() text: string = '';
  @Input() size: string = 'default';
  @Input() variant: string = 'text-';

  private textTypeSize: { [key: string]: string } = {

    xxlarge: 'text-[22px] font-normal',
    xlarge: 'text-[20px] font-medium',
    large: 'text-[18px] font-normal',
    medium: 'text-[17px] font-medium',
    regular: 'text-base font-normal',
    small: 'text-[15px] font-normal',
    xsmall: 'text-[13px] font-normal',
    xxsmall: 'text-xs font-normal tracking-widest',

  };

  private textTitleVariant: { [key: string]: string } = {   

    primary: 'text-black',
    secondary: 'text-primary',
    disable: 'text-gray',
    tertiary: 'text-white'

  };

  get classes(): string {
    return `${this.textTypeSize[this.size]} ${this.textTitleVariant[this.variant]}`;
  };
}
