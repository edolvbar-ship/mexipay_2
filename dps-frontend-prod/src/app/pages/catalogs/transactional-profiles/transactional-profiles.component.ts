import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Subscription, takeUntil, tap } from 'rxjs';

import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService } from '@/app/services/shared/search/search.service';

import { TransactionProfilesService } from '@/app/services/catalogues/transaction-profiles/transaction-profiles.service';
import { TransactionalProfileTableInterface } from '@/app/shared/interfaces/transaction-profile-interface';

@Component({
    selector: 'app-transactional-profiles',
    imports: [
        SectionTitleComponent,
        TableLayoutComponent,
        CardContainerComponent,
        ModalConfirmComponent
    ],
    templateUrl: './transactional-profiles.component.html',
    styleUrl: './transactional-profiles.component.css'
})
export default class TransactionalProfilesComponent implements OnInit, OnDestroy{

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private transactionProfilesService: TransactionProfilesService,
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
  linkNewRow: string[] = ['/catalogos','perfil-transaccional', 'create'];
  transactionalProfileData: TransactionalProfileTableInterface[] = []; 
  allTransactionalProfileData: TransactionalProfileTableInterface[] = []; 
  search: string = '';
  actions: any[] = []

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();
    
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.transactionalProfileData = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allTransactionalProfileData));

    this.getActions()
  }

  getActions():any {
    this.actions = [];
    if (this.canEdit && !this.canDelete) {
        this.actions.push({
            callbackEdit: this.editItem.bind(this),
            params: { confirm: true },
            ico: 'pi pi-ellipsis-v',
            labelOne: 'Editar',
        });
    }
    if (this.canDelete && !this.canEdit) {
        this.actions.push({
            callbackDelet: this.deleteItem.bind(this),
            params: { confirm: true },
            ico: 'pi pi-ellipsis-v',
            labelTwo: 'Eliminar', 
        });
    }
    if(this.canEdit && this.canDelete) {
      this.actions.push({
        callbackDelet: this.deleteItem.bind(this),callbackEdit: this.editItem.bind(this),
        params: { confirm: true },
        ico: 'pi pi-ellipsis-v',
        labelOne: 'Editar',
        labelTwo: 'Eliminar', 
    });
    }
  }

  loadData():void {
    this.transactionProfilesService.getAllData().pipe(
      tap((response) => {
        this.transactionalProfileData = response;
        this.allTransactionalProfileData = response
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
      this.transactionProfilesService.getDataSearched(this.search).subscribe( filterInformation => {
        this.transactionalProfileData = filterInformation;
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
    this.transactionProfilesService.deletePersonType(id).subscribe(
      {
        next: () => {
          this.toastSrv.success('Perfil transaccional eliminado correctamente.'); 
          this.transactionalProfileData = this.transactionalProfileData.filter( item => item.id !== id);
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
