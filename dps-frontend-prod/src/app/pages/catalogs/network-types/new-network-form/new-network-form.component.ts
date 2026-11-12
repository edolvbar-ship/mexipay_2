import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { Component, OnInit } from '@angular/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
 } from '@angular/forms';

 import { ToastrService } from 'ngx-toastr';

 import { LogicalNetworksService } from '@/app/services/catalogues/logical-networks/logical-networks.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-network-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-network-form.component.html',
    styleUrl: './new-network-form.component.css'
})
export default class NewNetworkFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','red-logica']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Tipo de Red Lógica";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private logicalNetworksService: LogicalNetworksService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      ln: ['', Validators.required],
      name: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Tipo de Red Lógica";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.logicalNetworksService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_ln,
          ln: data.ln,
          name: data.name,
        });
      },
      error: (error) => {
        this.toastSrv.error('No se ha encontrado información para este id.');
        this.router.navigate(this.linkText);
      },
    });
  };

  saveForm():void {
    if(!this.formGroup.invalid) {

      this.formTrimService.trimFormValues(this.formGroup)

      const id    = this.formGroup.get('id')?.value;
      const ln    = this.formGroup.get('ln')?.value;
      const name  = this.formGroup.get('name')?.value;

      if(id != 0){
        this.logicalNetworksService.updateData({ id, ln, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Red lógica actualizada correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.logicalNetworksService.saveData({ ln, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Red lógica guardada correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido guardado de la información.');
          }
        });
      }

    }else{
      this.toastSrv.info('Revisa la información ingresada.');
    }
  }

}
