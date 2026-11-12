import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersTDMComponent } from './users-tdm.component';

describe('UsersTDMComponent', () => {
  let component: UsersTDMComponent;
  let fixture: ComponentFixture<UsersTDMComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersTDMComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UsersTDMComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
