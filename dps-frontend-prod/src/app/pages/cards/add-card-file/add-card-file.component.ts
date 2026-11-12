import { BinesService } from '@/app/services/bines/bines.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-add-card-file',
    imports: [
        CommonModule,
        CardContainerComponent,
        SectionTitleComponent,
        TextTitleComponent
    ],
    templateUrl: './add-card-file.component.html',
    styleUrl: './add-card-file.component.css'
})
export class AddCardFileComponent {

   @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  selectedFile: File | null = null;
  uploading:boolean = false;
  fileMessage:string = "Selecciona el Archivo";

  formData = new FormData();

  constructor(
    private binesService: BinesService,
    private toastSrv: ToastrService,
    private http: HttpClient
  ) { }

  onFileSelected(event: any): void {
    const file: File = event.target.files?.item(0);;
    if (file) {

      const fileType = file.name.split('.').pop();

      if (fileType !== 'csv') {
        this.toastSrv.info('Es necesario seleccionar un archivo .CSV.'); 
        return;
      } 

      this.selectedFile = file;
      this.fileMessage = file.name;
      this.formData.append("file", file);
    }
  }

  openFileBrowser(): void {
    this.fileInput.nativeElement.click();
  }

  onUpload(): void {


    if (this.selectedFile) {

      this.uploading = true;
      const formData = new FormData();

      const uploadUrl = this.binesService.getUrlUpload();


      formData.append('file', this.selectedFile, this.selectedFile.name);
      
      this.http.post(uploadUrl, formData)
      .subscribe(
        (response: any) => {
          this.fileMessage = 'Selecciona el Archivo';
          this.toastSrv.success('Archivo subido exitosamente.');
          this.uploading = false;
        },
        (error) => {
          this.toastSrv.error('Error en la subida del archivo.'); 
          this.uploading = false; 
        }
      );

    } else {
      this.toastSrv.info('Por favor selecciona un archivo primero.'); 
    }
  }


}
