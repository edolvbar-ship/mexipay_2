import { Component, Input, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActionButtonComponent } from '../action-button/action-button.component';

@Component({
    selector: 'button-filter',
    imports: [CommonModule, ActionButtonComponent],
    templateUrl: './button-filter.component.html',
    styleUrls: ['./button-filter.component.css']
})
export class ButtonFilterComponent implements OnInit {
  @Input() dataList: string[] = [];
  @Output() deselectionChange = new EventEmitter<string[]>();

  isVisible: boolean = false;
  checkboxes: boolean[] = [];
  emitCounter: number = 0;
  initialized: boolean = false; 

  ngOnInit(): void {
    if (this.dataList && this.dataList.length > 1) {
      this.initializeCheckboxes();
  }
  }

  initializeCheckboxes() {
    this.checkboxes = this.dataList.map(() => true);
    this.emitDeselection();
}

toggleCheckbox(index: number) {
  this.checkboxes[index] = !this.checkboxes[index];
  this.emitDeselection(); 
}

  emitDeselection() {
    const deselectedValues = this.checkboxes
        .map((selected: boolean, index: number) => !selected ? this.dataList[index] : null)
        .filter((item: string | null) => item !== null);
      this.deselectionChange.emit(deselectedValues);
  }

  switchList() {
    this.isVisible = !this.isVisible;
    if (!this.initialized) { 
      this.initializeCheckboxes();
      this.initialized = true; 
    }
  }
}
