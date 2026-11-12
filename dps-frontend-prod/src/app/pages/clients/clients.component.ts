import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ShowDataClient } from '@/app/shared/interfaces/clients.interface';
import { ClientsService } from '@/app/services/clients/clients.service';
import { catchError, of, Subject, takeUntil, tap } from 'rxjs';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { SearchService } from '@/app/services/shared/search/search.service';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
interface Action {
  callbackEdit?: (row: any) => void; 
  callbackDelet?: (row: any) => void; 
  params: { confirm: boolean };
  ico: string;
  labelOne?: string; 
  labelTwo?: string; 
}
@Component({
    selector: 'app-clients',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        TableLayoutComponent,
        ModalConfirmComponent
    ],
    templateUrl: './clients.component.html',
    styleUrls: ['./clients.component.css']
})


export default class ClientsComponent implements OnInit, OnDestroy {

  constructor(
    private clientsService: ClientsService,
    private searchService: SearchService,
    private toastService: ToastrService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.canEdit = this.route.snapshot.data['canEdit'];
    this.canCreate = this.route.snapshot.data['canCreate'];
    this.canDelete = this.route.snapshot.data['canDelete'];
  }

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  triggerModal() {
    this.modal.confirm();
  }

  linkText: string[] = ['/clientes', 'create'];

  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false
  

  clients: ShowDataClient[] = [];
  allClients: ShowDataClient[] = []
  search: string = '';
  usersSaved: any = {};
  userDelet: any = {};
  actions: any[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.clients = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allClients));

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
  
  
  get showActions() {
    if (this.canEdit || this.canDelete) {
    return true
    } else return false
  }

  loadData():void {
    this.clientsService.getClients().pipe(
      tap((response) => {
        this.clients = response;
        this.allClients = response;
      }),
      catchError(error => {
        console.error('Error trayendo datos', error);
        return of([]);
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  editItem(row: any) {
    const id = row.Id
    this.router.navigate([`/clientes/edit/${id}`])
  }

  deleteItem(row: any) {
    this.userDelet = row
    this.triggerModal()
  }

  handleAccept() {
    const id =  this.userDelet.Id
    this.deletUser(id)
  }

  deletUser(id: number): void {
    this.clientsService.deletClient(id).subscribe(
      {
        next: () => {
          this.clients = this.clients.filter(user => user.Id !== id);
          this.allClients = this.clients
          this.toastService.success('Usuario eliminado con éxito')
        },
        error: (err) => {
        }
      }
    )
  }

  viewDetail(row: any) {
    const id = row.Id
    this.router.navigate([`/clientes/detail/${id}`]);
  }

  handleReject() {
    console.info('Acción cancelada')
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}