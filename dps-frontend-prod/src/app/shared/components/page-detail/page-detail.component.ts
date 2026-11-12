import { Component, Input, OnInit } from '@angular/core';
import { CardContainerComponent } from "../card-container/card-container.component";
import { TextTitleComponent } from "../text-title/text-title.component";
import { TextTypeComponent } from "../text-type/text-type.component";
import { CommonModule } from '@angular/common';

@Component({
    selector: 'page-detail',
    imports: [CardContainerComponent, TextTitleComponent, TextTypeComponent, CommonModule],
    templateUrl: './page-detail.component.html',
    styleUrl: './page-detail.component.css'
})
export class PageDetailComponent{

  @Input() title: string = '';
  @Input() data: any = [];


  get dataKeys() {
    if(this.data) {
      return Object.keys(this.data)
    } else return;
  }

}
