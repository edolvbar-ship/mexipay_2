import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Subscription, takeUntil, tap } from 'rxjs';

// services
import { PersonTypeService } from '@/app/services/catalogues/person-types/person-types.service';
import { SearchService } from '@/app/services/shared/search/search.service';

// interfaces
import { PersonTypeDataInterface, PersonTypeTableInterface } from '@/app/shared/interfaces/person-type-interface';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    selector: 'app-person-type',
    imports: [SectionTitleComponent, TableLayoutComponent, CardContainerComponent, ModalConfirmComponent],
    templateUrl: './person-type.component.html',
    styleUrl: './person-type.component.css'
})
export default class PersonTypeComponent implements OnInit, OnDestroy{

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private personTypeService: PersonTypeService,
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
  linkNewRow: string[] = ['/catalogos','tipo-de-personas', 'create'];
  personTypeData: PersonTypeTableInterface[] = []; 
  allPersonTypeData: PersonTypeTableInterface[] = []; 
  search: string = '';
  actions: any = []

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.personTypeData = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allPersonTypeData));

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

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadData():void {
    this.personTypeService.getPersonType().pipe(
      tap((response) => {
        this.personTypeData = response;
        this.allPersonTypeData = response;
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  deleteItem(row: any, params: any) {
    this.rowSelected = row;
    this.triggerModal();
  }

  editItem(row: any, params: any) {
    this.router.navigate(['/catalogos','tipo-de-personas','edit', row.id]);
  }

  triggerModal() {
    this.modal.confirm(); // Llamar al método open del modal
  }

  sendSearch(search: string): void {
    this.search = search;
    if(search !== '') {
      this.personTypeService.getDataSearched(this.search).subscribe(filterInformation => {
        this.personTypeData = filterInformation;
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
    this.personTypeService.deletePersonType(id).subscribe(
      {
        next: () => {
          this.toastSrv.success('Tipo de persona eliminada correctamente.'); 
          this.personTypeData = this.personTypeData.filter( item => item.id !== id);
        },
        error: (err:any) => {
          this.toastSrv.error('Un error ha ocurrido, no se ha podido eliminar de la información.');
        }
      }
    );
  }


}
