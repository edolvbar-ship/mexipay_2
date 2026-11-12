import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, AbstractControl, Validators } from '@angular/forms';
import { ProfilesService } from '@/app/services/security/profiles/profiles.service';
import { ToastrService } from 'ngx-toastr';
import { catchError, map, mergeMap, Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { ToggleSwitchComponent } from "../../../../shared/components/inputs/input-switch/input-switch.component";

export interface Root {
  data: Profile[];
  message: string;
}

export interface Profile {
  id: number;
  icon: any;
  father_resource?: number;
  resource_name: string;
  resource_url: string;
  isF: number;
  isConfig: number;
  isCrud: number;
  isGroup: number;
  justPage: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: any;
  canCreate?: number | null,
  canEdit?: number | null,
  canDelete?: number | null,
}

interface Resource {
  id_resource: number;
  icon: string | null;
  father_resource: string | null;
  resource_name: string | null;
  resource_url: string;
  create: number;
  edit: number;
  delete: number;
  select: number;
}

interface SendProfile {
  profile_name: string;
  comments: string;
  datos_bancarios: boolean;
  resources: Resource[];
}

@Component({
    selector: 'app-new-profile-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        CommonModule,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule,
        ToggleSwitchComponent
    ],
    templateUrl: './new-profile-form.component.html',
    styleUrls: ['./new-profile-form.component.css']
})
export class NewProfileFormComponent implements OnInit, OnDestroy {

  linkText: string[] = ['/profiles'];
  profilesData: Profile[] = []
  form: FormGroup =  this.fb.group({
    profile_name: ['', Validators.required],
    message: '',
    banking_information: [false],
    profiles: this.fb.array(this.profilesData.map((profile: any) => this.fb.group({
      isCrud: [profile.isCrud],
      resource_name: [profile.resource_name],
      canCreate: [profile.canCreate],
      canEdit: [profile.canEdit],
      canDelete: [profile.canDelete],
      children: this.fb.array(profile.children.map((child: any) => this.fb.group({
        isCrud: [child.isCrud],
        resource_name: [child.resource_name],
        canCreate: [profile.canCreate],
        canEdit: [profile.canCreate],
        canDelete: [profile.canCreate]
      })))
    })))
  });

  activeCrudProfiles: Profile[] = [];
  profileId: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private profileService: ProfilesService,
    private toastService: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam) : null;
    this.profileId = id;

    this.getProfileData().pipe(
        mergeMap(() => {
            if (this.profileId) {
                return this.profileService.getProfileById(this.profileId).pipe(
                    tap(response => {
                        this.setFormValues(response);
                    }),
                    catchError(error => {
                        console.error('Error trayendo la información del cliente', error);
                        return of();
                    })
                );
            } else {
                return of();
            }
        }),
        takeUntil(this.destroy$)
    ).subscribe();
}




getProfileData(): Observable<void> {
  return this.profileService.getProfilesResouces().pipe(
      map((response: Root) => {
          this.setProfileData(response.data);
          this.profilesData = this.ensureProfileFields(response.data);
          return;
      }),
      catchError(error => {
          console.error('Error al obtener los perfiles:', error);
          return of();
      })
  );
}



  ensureProfileFields(profiles: Profile[]): Profile[] {
    return profiles.map(profile => {
      const {
        canCreate = 0,
        canEdit = 0,
        canDelete = 0,
        ...rest
      } = profile;
      return {
        ...rest,
        canCreate,
        canEdit,
        canDelete,
      };
    });
  }

  setProfileData(profiles: Profile[]): void {

    const profileArray = this.form.get('profiles') as FormArray;
    profileArray.clear();

    this.activeCrudProfiles = [];

    profiles.forEach(profile => {
        const profileGroup = this.fb.group({
            id: [profile.id],
            resource_name: [profile.resource_name],
            isCrud: [false],
            canCreate: [0],
            canEdit: [0],
            canDelete: [0],
            children: this.fb.array([])
        });


        if (profile.isCrud) {
            this.activeCrudProfiles.push(profile);
        }

        if (profile.father_resource) {
            const parentGroup = profileArray.controls.find((control: any) => control.get('id').value === profile.father_resource);
            if (parentGroup) {
                (parentGroup.get('children') as FormArray).push(profileGroup);
            }
        } else {
            profileArray.push(profileGroup);
        }
    });
}

setFormValues(response: any) {
  this.form.patchValue({
    profile_name: response.data.profile_name,
    message: response.data.comments,
    banking_information: response.data.datos_bancarios
  })
  this.setFormValuesCheckBox(response.details)
}

setFormValuesCheckBox(profiles: any[]): void {
  const profileArray = this.form.get('profiles') as FormArray;

  profiles.forEach(profile => {
      const matchingGroup = profileArray.controls.find((control) => {
          const group = control as FormGroup;
          return group.get('id')?.value === profile.id_resource;
      });


      if (matchingGroup) {
          matchingGroup.patchValue({
              isCrud: true,
              canCreate: profile.create,
              canEdit: profile.edit,
              canDelete: profile.delete
          });
      }
  });

profileArray.controls.forEach((ctrl) => {
  const grp = ctrl as FormGroup;
  const childrenArr = grp.get('children') as FormArray;

  if (childrenArr) {
      childrenArr.controls.forEach((childCtrl) => {
          const childGroup = childCtrl as FormGroup;
          const childId = childGroup.get('id')?.value;
          const matchingProfile = profiles.find(profile => profile.id_resource === childId);

          if (matchingProfile) {
              childGroup.patchValue({
                isCrud: true,
                canCreate: matchingProfile.create,
                canEdit: matchingProfile.edit,
                canDelete: matchingProfile.delete
              });
          }
      });
  }
});

}

isCrudActive(profileId: number): boolean {
    return this.activeCrudProfiles.some((profile: Profile) => profile.id === profileId);
}

get profiles(): FormArray {
    return this.form.get('profiles') as FormArray;
}

getChildren(profile: any): FormArray {
  return profile.get('children') as FormArray;
}


isChildCrudActive(profileId: number, childId: number): boolean {
    return this.activeCrudProfiles.some(profile => profile.id === childId);
}

onSubmit(): void {
  this.form.markAllAsTouched();
  if(!this.form.invalid) {
    this.getDataForm()
  } else this.toastService.info('Revisa la información ingresada.')
}

private getDataForm() {
  const profilesArray = this.form.get('profiles') as FormArray;
  const validProfiles = this.getValidProfiles(profilesArray);

  const profileValuesArray = this.extractProfileValues(validProfiles);
  const childValuesArray = this.extractChildValues(validProfiles);

  const combinedArray = [...profileValuesArray, ...childValuesArray];

  this.createResponse(combinedArray);
}

private getValidProfiles(profilesArray: FormArray): AbstractControl[] {
  return profilesArray.controls.filter((control: AbstractControl) => {
    const profileGroup = control as FormGroup;
    const isProfileActive = profileGroup.get('isCrud')?.value === true;
    const childrenArray = profileGroup.get('children') as FormArray;

    const hasActiveChildren = childrenArray.controls.some((childControl: AbstractControl) => {
      const childGroup = childControl as FormGroup;
      return childGroup.get('isCrud')?.value === true;
    });

    return isProfileActive || hasActiveChildren;
  });
}

private extractProfileValues(validProfiles: AbstractControl[]): any[] {
  return validProfiles.map(control => {
    const profileGroup = control as FormGroup;
    return profileGroup.value;
  });
}

private extractChildValues(validProfiles: AbstractControl[]): any[] {
  const childValues: any[] = [];

  validProfiles.forEach(control => {
    const profileGroup = control as FormGroup;
    const childrenArray = profileGroup.get('children') as FormArray;

    const activeChildren = childrenArray.controls.filter(childControl => {
      const childGroup = childControl as FormGroup;
      return childGroup.get('isCrud')?.value === true;
    });

    activeChildren.forEach(childControl => {
      const childGroup = childControl as FormGroup;
      childValues.push(childGroup.value);
    });
  });

  return childValues;
}

createResponse(profiles: any[]): void {

    const transformedResponse: SendProfile = {
        profile_name: this.form.value.profile_name.trim(),
        comments: this.form.value.message.trim() || '',
        datos_bancarios: this.form.value.banking_information,
        resources: profiles.map((item: any) => ({
          id_resource: item.id,
          create: item.canCreate,
          edit: item.canEdit,
          delete: item.canDelete,
          icon: '',
          father_resource: null,
          resource_name: null,
          resource_url: this.createURL(item.resource_name),
          select: item.isCrud
      }))
    };
    this.profileId
      ? this.updateProfile(transformedResponse)
      : this.createProfile(transformedResponse)
}

updateProfile(data: any) {
  data.id_profile = this.profileId;
  const body = data
  const id = this.profileId
  this.profileService.updateProfile(id, body).subscribe({
    next: () => {
      this.toastService.success('Perfil guardado')
      this.router.navigate(['/profiles']);
    },
    error: (error) => {
      this.toastService.error(error.error.message)
    }
  })
}

createProfile(data: any){
  this.profileService.postCreateProfile(data).subscribe({
    next: () => {
      this.toastService.success('Perfil guardado')
      this.router.navigate(['/profiles']);
    },
    error: (error) => {
      this.toastService.error(error.error.message)
    }
  })
}

createURL(name: string): string {
  const resource = this.profilesData.find(r => r.resource_name === name);
  return resource?.resource_url || ''
}

ngOnDestroy(): void {
  this.profileId = null
  this.destroy$.next();
  this.destroy$.complete();
}
}
