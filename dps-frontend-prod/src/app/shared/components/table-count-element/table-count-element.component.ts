import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';

interface Items {
  name: string;
  code: number;
}

@Component({
  selector: 'table-count-element',
  imports: [Select, FormsModule],
  templateUrl: './table-count-element.component.html',
  styleUrls: ['./table-count-element.component.css']
})
export class TableCountElementComponent implements OnInit{
  options: Items[] = [];

  itemsPerPage: Items[] = [];

  @Output() selectionChanged: EventEmitter<Items> = new EventEmitter<Items>();

  ngOnInit(): void {
    this.options = [
      { name: '5', code: 5 },
      { name: '10', code: 10 },
      { name: '15', code: 15 },
      { name: '50', code: 50 }
    ];
  }

  onChange(event: { value: Items}) {
    this.selectionChanged.emit(event.value);
  }
}
