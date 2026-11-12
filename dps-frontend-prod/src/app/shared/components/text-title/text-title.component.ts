import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'text-title',
    imports: [CommonModule],
    templateUrl: './text-title.component.html',
    styleUrl: './text-title.component.css'
})
export class TextTitleComponent {
  @Input() text: string = '';
  @Input() size: string = 'medium';
  @Input() variant: string = 'primary';
  @Input() level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' = 'p';


/* Configura el peso y tamaño de fuente, se obtiene de size*/

  private textTitleSize: { [key: string]: string } = {
    
    xlarge: 'text-[33px] font-bold text-center',
    large: 'text-[25px] font-bold',
    medium: 'text-[23px] font-bold',
    regular: 'text-xl font-bold',
    small: 'text-xl font-medium',
    xsmall: 'text-lg font-semibold',    

  };

/* Configura el color de fuente, se obtiene de variant*/

  private textTitleVariant: { [key: string]: string } = {   

    primary: 'text-black',
    secondary: 'text-primary',
    disable: 'text-gray',
    tertiary: 'text-white'

  };

  get classes(): string {
    return `${this.textTitleSize[this.size]} ${this.textTitleVariant[this.variant]}`;
  };
}
