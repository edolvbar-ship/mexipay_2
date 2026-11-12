import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { ActivatedRoute } from '@angular/router';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, of, Subject, Subscription, takeUntil, tap } from 'rxjs';

import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { SearchService } from '@/app/services/shared/search/search.service';
import { BinesTableInterface } from '@/app/shared/interfaces/bines.interface';
import { BinesService } from '@/app/services/bines/bines.service';
import { CommonModule } from '@angular/common';
import { ActionButtonComponent } from "../../shared/components/action-button/action-button.component";

@Component({
    selector: 'app-cards',
    imports: [
        CardContainerComponent,
        TextTitleComponent,
        TextTypeComponent,
        ModalConfirmComponent,
        TableLayoutComponent,
        CommonModule,
        ActionButtonComponent
    ],
    templateUrl: './cards.component.html',
    styleUrl: './cards.component.css'
})
export class CardsComponent implements OnInit, OnDestroy{


  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private binesService: BinesService,
    private toastSrv: ToastrService,
    private router: Router,
    private searchService: SearchService,
    private route: ActivatedRoute
  
  ) { 
    this.canEdit = this.route.snapshot.data['canEdit'];
    this.canCreate = this.route.snapshot.data['canCreate'];
    this.canDelete = this.route.snapshot.data['canDelete'];
  }

  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false
  
  // Params
  private subscription: Subscription | null = null;
  rowSelected: any = {};
  linkNewRow: string[] = ['/tarjetas', 'create'];
  binesData: BinesTableInterface[] = []; 
  allBinesData: BinesTableInterface[] = []; 
  search: string = '';
  actions: any[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.binesData = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allBinesData));
    this.getActions()
  }

  getActions(): void {
    this.actions = [];
    const action = { params: { confirm: true }, ico: 'pi pi-ellipsis-v' };
  
    if (this.canEdit || this.canDelete) {
      this.actions.push({
        ...action,
        callbackEdit: this.canEdit ? this.editItem.bind(this) : this.viewDetail.bind(this),
        callbackDelet: this.canDelete ? this.deleteItem.bind(this) : this.viewDetail.bind(this),
        labelOne: this.canEdit ? 'Editar' : 'Ver Detalle',
        labelTwo: this.canDelete ? 'Eliminar' : 'Ver Detalle'
      });
    } else {
      this.actions.push({
        params: { confirm: true },
        ico: 'pi pi-eye',
        callback: this.viewDetail.bind(this),
      });
    }
  }

  loadData():void {
    this.binesService.getAllData().pipe(
      tap((response) => {
        this.binesData = response;
        this.allBinesData = response;
      }),
      catchError(error => {
        console.error('Error trayendo datos', error);
        return of([]);
      }),
      takeUntil(this.destroy$)).subscribe()
  }

  deleteItem(row: any, params: any) {
    this.rowSelected = row;
    this.triggerModal();
  }

  editItem(row: any, params: any) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    const id = row.id
    this.router.navigate([`/tarjetas/edit/${id}`]);
  }


  triggerModal() {
    this.modal.confirm(); // Llamar al método open del modal
  }
  
  // modal functions
  handleReject() {
    this.rowSelected = {};
  }

  handleAccept() {
    this.deleteRow();
  }

  deleteRow(): void {
    const id = this.rowSelected.id
    this.binesService.deletePersonType(id).subscribe(
      {
        next: () => {
          this.toastSrv.success('Perfil transaccional eliminado correctamente.'); 
          this.binesData = this.binesData.filter( item => item.id !== id);
        },
        error: (err:any) => {
          this.toastSrv.error('Un error ha ocurrido, no se ha podido eliminar de la información.');
        }
      }
    );
  }

  viewDetail(row: any) {
    const id = row.id
    this.router.navigate([`/tarjetas/detail/${id}`]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
