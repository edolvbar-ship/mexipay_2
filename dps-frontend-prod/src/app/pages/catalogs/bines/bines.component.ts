import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Subscription, takeUntil, tap } from 'rxjs';

import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { SearchService } from '@/app/services/shared/search/search.service';
import { BinesTableInterface } from '@/app/shared/interfaces/bines.interface';
import { BinesService } from '@/app/services/bines/bines.service';


@Component({
    selector: 'app-bines',
    imports: [
        SectionTitleComponent,
        TableLayoutComponent,
        CardContainerComponent,
        ModalConfirmComponent
    ],
    templateUrl: './bines.component.html',
    styleUrl: './bines.component.css'
})
export default class BinesComponent implements OnInit, OnDestroy{

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private binesService: BinesService,
    private toastSrv: ToastrService,
    private router: Router,
    private searchService: SearchService
  ) {}

  
  // Params
  private subscription: Subscription | null = null;
  rowSelected: any = {};
  linkNewRow: string[] = ['/catalogos','perfil-transaccional', 'create'];
  binesData: BinesTableInterface[] = []; 
  allBinesData: BinesTableInterface[] = []; 
  search: string = '';
  actions = [
    {
      callbackDelet: this.deleteItem.bind(this),
      params: { confirm: true },
      ico: 'pi pi-ellipsis-v',
      labelOne: 'Editar',
      labelTwo: 'Eliminar',
      callbackEdit: this.editItem.bind(this)
    }
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.binesData = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allBinesData));
    
  }

  loadData():void {
    this.binesService.getAllData().pipe(
      tap((response) => {
        this.binesData = response;
        this.allBinesData = response;
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  deleteItem(row: any, params: any) {
    this.rowSelected = row;
    this.triggerModal();
  }

  editItem(row: any, params: any) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.router.navigate(['/catalogos','perfil-transaccional','edit', row.id]);
  }


  triggerModal() {
    this.modal.confirm(); // Llamar al método open del modal
  }

  sendSearch(search: string): void {
    this.search = search;
    if(search !== '') {
      this.binesService.getDataSearched(this.search).subscribe( filterInformation => {
        this.binesData = filterInformation;
      });
    } else {
      this.loadData();
    }
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
