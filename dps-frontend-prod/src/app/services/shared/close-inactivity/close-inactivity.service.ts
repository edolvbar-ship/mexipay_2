import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class CloseInactivityService {

  private timeOutTime: number = 15;
  private timeOutId: any;

  constructor(private router: Router) {

    this.resetInactivityTimer();
  }


  resetInactivityTimer(){
    this.clearIncativityTimer();
    this.timeOutId = setTimeout(() => {
      this.logOut();
    }, this.timeOutTime * 60000);
  }

  clearIncativityTimer(){
    if(this.timeOutId) {
      clearTimeout(this.timeOutId)
    }
  }

  logOut(){
    this.router.navigate(['/logout']);
  }
}
