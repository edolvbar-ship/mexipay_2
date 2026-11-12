import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ToastNoAnimation } from 'ngx-toastr';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './config/interceptors/auth.interceptor';
import { provideToastr } from 'ngx-toastr';

import { MessageService } from 'primeng/api';
import { provideAnimations } from '@angular/platform-browser/animations'
import { ConfirmationService } from 'primeng/api';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { spinnerInterceptor } from './config/interceptors/spinner.interceptor';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { tokenInterceptor } from './config/interceptors/token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), 
    provideHttpClient(withFetch(), 
    withInterceptors([
      spinnerInterceptor,
      authInterceptor,
      tokenInterceptor
    ])),
    provideToastr({
      toastComponent: ToastNoAnimation
    }),
    MessageService,
    provideAnimations(),
    ConfirmationService,
    provideEnvironmentNgxMask(),
    DatePipe,
    CurrencyPipe
  ]
};
