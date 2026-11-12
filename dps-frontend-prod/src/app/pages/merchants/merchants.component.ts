import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MerchantsService } from '@/app/services/merchants/merchants.service';
import { ShowMerchantsInterface } from '@/app/shared/interfaces/merchants.interface';
import { catchError, takeUntil, tap } from 'rxjs/operators';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { SearchService } from '@/app/services/shared/search/search.service';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { ToastrService } from 'ngx-toastr';
import { FormDataService } from '@/app/services/shared/form-data/form-data.service';
import { DataMaskerService } from '@/app/services/shared/data-masker/data-masker.service';
import { of, Subject } from 'rxjs';

@Component({
    selector: 'app-merchants',
    imports: [CardContainerComponent, SectionTitleComponent, TableLayoutComponent, ModalConfirmComponent ],
    templateUrl: './merchants.component.html',
    styleUrls: ['./merchants.component.css'] // Corregido 'styleUrl' a 'styleUrls'
})
export class MerchantsComponent implements OnInit, OnDestroy {

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  triggerModal() {
    this.modal.confirm();
  }

  constructor(
    private merchantService: MerchantsService,
    private searchService: SearchService,
    private toastService: ToastrService,
    private router: Router,
    private formService: FormDataService,
    private route: ActivatedRoute,
    private dataMaskerService: DataMaskerService
  ) {
    this.canEdit = this.route.snapshot.data['canEdit'];
    this.canCreate = this.route.snapshot.data['canCreate'];
    this.canDelete = this.route.snapshot.data['canDelete'];
  }

  linkText: string[] = ['/comercios', 'create'];

  merchants: ShowMerchantsInterface[] = [];
  allMerchants: ShowMerchantsInterface[] = [];

  merchantDelet: any = {};

  search: string = '';

  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false;

  actions: any[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.initializeSearch();

    this.getActions();
  }

  initializeSearch() {
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.merchants = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allMerchants));
  }

  loadData(): void {
    this.merchantService.getMerchants().pipe(
      tap((response) => {
        this.merchants = response;
        this.allMerchants = response; 
      }),
      catchError(error => {
        console.error('Error trayendo datos', error);
        return of([]);
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  getActions(): any {
    this.actions = [];
    console.log('getActions called - canEdit:', this.canEdit, 'canDelete:', this.canDelete);
    
    if (this.canEdit && !this.canDelete) {
      console.log('Setting up edit-only actions');
      this.actions.push({
        callbackEdit: this.editItem.bind(this),
        callbackDelet: this.viewDetail.bind(this),
        params: { confirm: true },
        ico: 'pi pi-ellipsis-v',
        labelOne: 'Editar',
        labelTwo: 'Ver Detalle'
      });
    }
    if (this.canDelete && !this.canEdit) {
      console.log('Setting up delete-only actions');
      this.actions.push({
        callbackDelet: this.deleteItem.bind(this),
        callbackEdit: this.viewDetail.bind(this),
        params: { confirm: true },
        ico: 'pi pi-ellipsis-v',
        labelOne: 'Ver Detalle',
        labelTwo: 'Eliminar',
      });
    }
    if (this.canEdit && this.canDelete) {
      console.log('Setting up full actions (edit, delete, view)');
      this.actions.push({
        callbackDelet: this.deleteItem.bind(this),
        callbackEdit: this.editItem.bind(this),
        callbackView: this.viewDetail.bind(this),
        params: { confirm: true },
        ico: 'pi pi-ellipsis-v',
        labelOne: 'Editar',
        labelTwo: 'Eliminar',
        labelThree: 'Ver Detalle'
      });
    }
    if (!this.canEdit && !this.canDelete) {
      console.log('Setting up view-only actions');
      this.actions.push({
        callback: this.viewDetail.bind(this),
        params: { confirm: true },
        ico: 'pi pi-eye',
      });
    }
    
    console.log('Final actions array:', this.actions);
    return this.actions;
  }

  editItem(row: any) {
    console.log('editItem called with row:', row);
    this.router.navigate([`/comercios/edit/${row.Id}`])
  }

  viewDetail(row: any) {
    console.log('viewDetail called with row:', row);
    this.merchantService.getMerchantById(row.Id).subscribe({
      next: (response) => {
        console.log('getMerchantById response:', response);
        this.getDetailData(response);
      },
      error: (error) => {
        console.error('Error in getMerchantById:', error);
      }
    });
  }

  getDetailData(data: any) {
    const maskedDetail = this.dataMaskerService.applyMasks(data);
    this.router.navigate([`/comercios/detail/${data.Id}`]);
  }

  transformDetail(data: any) {
    const merchantDetail = {
      Estatus: data.active === 1 ? 'Activo' : 'Inactivo',
      MMC: `${data.mcc} - ${data.mcc_desc}`,
      'Agente Comercial': data.agente_comercial,
      'Contacto Comercio': data.contact_merchant,
      Celular: data.mobile_contact,
      'Teléfono Principal': data.tel1_contact,
      'Correo Electrónico': data.email_contact,
      'Token de Activación': data.token_activation,
      'Fecha de Creación': data.creation_date,
      'Última Actualización': data.last_update,
      'Tasa Crédito': data.t_credito,
      'Tasa Débito': data.t_debito,
      'Tasa Internacional': data.t_amex,
      'Rol del Contacto': data.rol_contact,
      Terminales: ''
    };
    this.sendToForm(merchantDetail);
    this.router.navigate([`/comercios/detail/${data.Id}`]);
  }

  sendToForm(data: any) {
    this.formService.setCurrentDataForm(data);
  }

  deleteItem(row: any) {
    console.log('deleteItem called with row:', row);
    this.merchantDelet = row;
    this.triggerModal();
  }

  handleAccept() {
    const id = {
      id_merchant: this.merchantDelet.Id
    };
    this.deletUser(id);
  }

  handleReject() {
    // Handle rejection - just close modal
    console.log('Delete action cancelled');
  }

  deletUser(id: any) {
    this.merchantService.deleteMerchant(id).subscribe({
      next: () => {
        this.merchants = this.merchants.filter(user => user.Id !== this.merchantDelet.Id);
        this.allMerchants = this.merchants.filter(merchant => merchant.Id !== this.merchantDelet.Id);
        this.toastService.success('Comercio eliminado exitosamente');
      },
      error: (error) => {
        console.error('Error deleting merchant:', error);
        this.toastService.error('Error al eliminar el comercio');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
