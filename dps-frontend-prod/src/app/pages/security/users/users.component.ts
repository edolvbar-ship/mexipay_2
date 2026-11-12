import { UsersService } from '@/app/services/security/users/users.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { ShowUserSecurityInterface } from '@/app/shared/interfaces/user-service.interface';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil, tap } from 'rxjs';
import { transformedDate } from '@/app/utils/utils';

@Component({
    selector: 'app-users',
    imports: [SectionTitleComponent, CardContainerComponent, TableLayoutComponent, ModalConfirmComponent],
    templateUrl: './users.component.html',
    styleUrl: './users.component.css'
})
export class UsersComponent implements OnInit, OnDestroy {

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private usersService: UsersService,
    private searchService: SearchService,
    private router: Router,
    private toastService: ToastrService,
    private route: ActivatedRoute,

  ) {
    this.canEdit = this.route.snapshot.data['canEdit'];
    this.canCreate = this.route.snapshot.data['canCreate'];
    this.canDelete = this.route.snapshot.data['canDelete'];
  }

  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false

  users: ShowUserSecurityInterface[] = [];
  allUsers: ShowUserSecurityInterface[] = [];
  linkText: string[] = ['/usuarios', 'create'];
  search: string = '';

  usersSaved: any = {};
  userDelet: any = {};

  actions: any[] = []

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.users = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allUsers));
    this.usersService.dataRecovered$.pipe(
      tap(respose => {
        this.usersSaved = respose
      })
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
    this.usersService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.getDataTable(users)
      });
  }

  private getDataTable(response: any) {
    const usersList = response.map((user: any) => {
      return {
        Id: user.id_user,
        Cliente: user.cliente?.name ? undefined : '',
        'Nombre de Usuario': user.username,
        Nombre: user.name,
        Apellido: user.last_name,
        'E-mail': user.mail,
        Creado: transformedDate(user.created_at),
        'Teléfono': user.telephone
      }
    });
    this.users = usersList;
    this.allUsers = usersList;
  }

  editItem(row: any) {
    this.router.navigate([`/usuarios/edit/${row.Id}`])
  }

  deleteItem(row: any, params: any) {
    this.userDelet = row
    this.triggerModal()
  }

  handleAccept() {
    const id = this.userDelet.Id
    this.deletUser(id)
  }

  triggerModal() {
    this.modal.confirm(); // Llamar al método open del modal
  }

  deletUser(id: number): void {
    this.usersService.deleteUser(id).pipe(takeUntil(this.destroy$)).subscribe(
      {
        next: () => {
          this.users = this.users.filter(user => user.Id !== id);
          this.toastService.success('Usuario eliminado con éxito')
        },
        error: (err) => {
          this.toastService.error(err)
        }
      }
    )
  }

  handleReject() {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
