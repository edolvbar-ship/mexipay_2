import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DialogModule } from 'primeng/dialog';

@Component({
    selector: 'app-modal-content',
    imports: [DialogModule],
    templateUrl: './modal-content.component.html',
    styleUrl: './modal-content.component.css'
})
export class ModalContentComponent {


@Input() visible: boolean = false;
@Output() visibleChange = new EventEmitter<boolean>();

    showDialog() {
        this.visible = true;
    }

    onClose() {
      this.visible = false
      this.visibleChange.emit(this.visible);
    }
}
