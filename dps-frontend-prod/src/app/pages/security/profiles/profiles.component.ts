import { ProfilesService } from '@/app/services/security/profiles/profiles.service';
import { FormDataService } from '@/app/services/shared/form-data/form-data.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { ShowProfilesInterfaces } from '@/app/shared/interfaces/profiles-service.interface';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil, tap } from 'rxjs';

@Component({
    selector: 'app-profiles',
    imports: [SectionTitleComponent, CardContainerComponent, TableLayoutComponent, ModalConfirmComponent],
    templateUrl: './profiles.component.html',
    styleUrl: './profiles.component.css'
})
export class ProfilesComponent implements OnInit, OnDestroy {
  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;
  constructor(
    private profileService: ProfilesService,
    private searchService: SearchService,
    private toastService: ToastrService,
    private foarmService: FormDataService,
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

  linkText: string[] = ['/profiles', 'create'];

  profiles: ShowProfilesInterfaces[] = [];
  allProfiles: ShowProfilesInterfaces[] = [];
  search: string = '';
  profileDelet: any = {};

  actions: any[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();
    
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.profiles = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allProfiles));
  
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

  loadData() {
    this.profileService.getProfiles().pipe(
      tap((response) => {
        this.profiles = response;
        this.allProfiles = response;
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  sendSearch(search: string): void {
    this.search = search;
    if(search !== '') {
      this.profileService.getDataSearched(this.search).subscribe(filteredData => {
        this.profiles = filteredData;
      });
    } else {
      this.loadData();
    }
  }
  triggerModal() {
    this.modal.confirm();
  }

  deleteItem(row: any) {
    this.profileDelet = row
    this.triggerModal()
  }

  editItem(row: any, params: any){
    this.filterProfile(row.Id)
  }

  filterProfile(id: number) {
    this.router.navigate([`/profiles/edit/${id}`])
  }


  handleAccept() {
    const id =  this.profileDelet.Id
    this.deleteProfile(id)
  }

  deleteProfile(id: number): void{
    this.profileService.deleteProfile(id).subscribe(
      {
        next: () => {
          this.profiles = this.profiles.filter(profile => profile.Id != id);
          this.toastService.success('Perfil eliminado corectamente')
        },
        error: (err) => {
          this.toastService.error('Hubo un error al intentar eliminar el perfil')
        }
      }
    )
  }
  handleReject(): void {
    console.info('No se ha realizado ninguna acción')
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
