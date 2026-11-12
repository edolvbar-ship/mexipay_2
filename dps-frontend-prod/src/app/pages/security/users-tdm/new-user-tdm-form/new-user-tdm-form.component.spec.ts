import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewUserTDMFormComponent } from './new-user-tdm-form.component';

describe('NewUserTDMFormComponent', () => {
  let component: NewUserTDMFormComponent;
  let fixture: ComponentFixture<NewUserTDMFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewUserTDMFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewUserTDMFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
