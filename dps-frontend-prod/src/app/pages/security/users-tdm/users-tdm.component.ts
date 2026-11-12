import { UsersTDMService } from '@/app/services/security/usersTDM/users-tdm.service';
import { FormDataService } from '@/app/services/shared/form-data/form-data.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { ShowTDMDataInterface } from '@/app/shared/interfaces/users-tdm-service.interface';
import { transformedDate } from '@/app/utils/transformedData';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, tap } from 'rxjs';

@Component({
    selector: 'app-users-tdm',
    imports: [SectionTitleComponent, CardContainerComponent, TableLayoutComponent, ModalConfirmComponent ],
    templateUrl: './users-tdm.component.html',
    styleUrl: './users-tdm.component.css'
})
export class UsersTDMComponent implements OnInit, OnDestroy {

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  triggerModal() {
    this.modal.confirm(); // Llamar al método open del modal
  }

  constructor(
    private usersTDMService: UsersTDMService,
    private searchService: SearchService,
    private formService: FormDataService,
    private router: Router,
    private route: ActivatedRoute

  ) {
    this.canEdit = this.route.snapshot.data['canEdit'];
    this.canCreate = this.route.snapshot.data['canCreate'];
    this.canDelete = this.route.snapshot.data['canDelete'];
  }

  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false

  usersSaved: any = {};
  userDelet: any = {};
  linkText: string[] = ['/usuarios-tdm', 'create'];
  usersTDM: ShowTDMDataInterface[] = [];
  allUsersTDM: ShowTDMDataInterface[] = [];
  search: string = '';
  actions: any[] = []


  private destroy$ = new Subject<void>();

  ngOnInit(): void {

    this.loadData()
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.usersTDM = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allUsersTDM));
    this.usersTDMService.dataRecovered$.pipe(
      tap(respose => this.usersSaved = respose)
    ).subscribe();
    this.getActions()
  }

  getActions(): any {
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
    if (this.canEdit && this.canDelete) {
      this.actions.push({
        callbackDelet: this.deleteItem.bind(this), callbackEdit: this.editItem.bind(this),
        params: { confirm: true },
        ico: 'pi pi-ellipsis-v',
        labelOne: 'Editar',
        labelTwo: 'Eliminar',
      });
    }
  }

  loadData(): void {
    this.usersTDMService.getUsersTDM().pipe(
      tap((response) => {
        this.getDataTable(response)
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  private getDataTable = (response: any) => {
    const TDMlist: ShowTDMDataInterface[] = response.map((tdm: any) => {
      return {
        Id: tdm.iduser,
        Nombre: tdm.first_name,
        "Apellido Paterno": tdm.last_name,
        "Apellido Materno": tdm.last_name2,
        "E-mail": tdm.email,
        Estado: tdm.estado,
        Creado: transformedDate(tdm.create_date)
      }
    });
    this.usersTDM = TDMlist;
    this.allUsersTDM = TDMlist
  }

  editItem(row: any) {
    //this.filterUser(row.Id)
    const id = row.Id
    this.router.navigate([`/usuarios-tdm/edit/${id}`])
  }

  deleteItem(row: any, params: any) {
    this.userDelet = row
    this.triggerModal()
  }

  handleAccept() {
    const id = this.userDelet.Id
    this.deletUser(id)
  }

  deletUser(id: number): void {
    this.usersTDMService.deleteUserTDM(id).subscribe(
      {
        next: () => {
          this.usersTDM = this.usersTDM.filter(user => user.Id !== id);
        },
        error: (err) => {
        }
      }
    )
  }

  handleReject() {
    // Lógica para cancelar la acción
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
