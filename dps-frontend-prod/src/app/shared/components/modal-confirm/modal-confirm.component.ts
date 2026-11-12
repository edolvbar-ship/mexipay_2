import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
    selector: 'modal-confirm',
    imports: [ConfirmDialogModule],
    templateUrl: './modal-confirm.component.html',
    styleUrls: ['./modal-confirm.component.css'],
    providers: [ConfirmationService]
})
export class ModalConfirmComponent {
  @Input() header: string = '';
  @Input() message: string = '';
  @Input() isVisible: boolean = false;

  @Input() acceptLabel: string = 'Aceptar';
  @Input() rejectLabel: string = 'Cancelar';
  @Output() visibleChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Output() accept: EventEmitter<void> = new EventEmitter<void>();
  @Output() reject: EventEmitter<void> = new EventEmitter<void>();

  constructor(private confirmationService: ConfirmationService, private messageService: MessageService) {}

  openModal(header: string, message: string, acceptLabel: string, rejectLabel: string): void {
    this.header = header;
    this.message = message;
    this.acceptLabel = acceptLabel;
    this.rejectLabel = rejectLabel;
    this.isVisible = true;
    this.visibleChange.emit(this.isVisible);
  }

  confirm() {
    this.confirmationService.confirm({
        header: '¿Estás seguro que deseas eliminar el registro?',
        message: 'Esta acción ya no se puede deshacer.',
        acceptIcon: 'none',
        rejectIcon: 'none',
        acceptLabel: 'Cancelar',
        rejectLabel: 'Aceptar',
        accept: () => {
            this.onAccept()
        },
        reject: () => {
            this.onReject()
        }
    });
}

  onAccept() {
    this.accept.emit();
    this.closeModal();
  }

  onReject() {
    this.reject.emit();  
    this.closeModal(); 
  }

  closeModal() {
    this.isVisible = false;
    this.visibleChange.emit(this.isVisible); 
  }
}
