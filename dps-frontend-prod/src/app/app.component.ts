import {Component, HostListener, inject, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config'
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message'
import { ButtonModule } from 'primeng/button'
import { SpinnerComponent } from './shared/components/spinner/spinner.component';
import { CloseInactivityService } from './services/shared/close-inactivity/close-inactivity.service';
import { lastValueFrom } from 'rxjs';
import { AuthMeService } from './services/auth/auth-me/auth-me.service';
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastModule, MessageModule, ButtonModule, SpinnerComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {

  private primeng = inject(PrimeNG);
  title = 'Mexipay';

  constructor(
    private closeSession: CloseInactivityService,
    authMeService: AuthMeService
  ) {
    lastValueFrom(authMeService.getMe());
    this.primeng.ripple.set(true);
  }

  @HostListener('window:mousemove')
  @HostListener('window:keydown')
  @HostListener('window:click')

  resetInactivity() {
    this.closeSession.resetInactivityTimer();
  }

  ngOnInit(): void {
    this.primeng.zIndex = {
      modal: 1100,
      overlay: 1000,
      menu: 1000,
      tooltip: 1100
    };
    this.primeng.setTranslation({
      dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
      today: 'Hoy',
      clear: 'Limpiar',
      dateFormat: 'dd/mm/yy',
      weekHeader: 'Sm'
    });
  }
}
