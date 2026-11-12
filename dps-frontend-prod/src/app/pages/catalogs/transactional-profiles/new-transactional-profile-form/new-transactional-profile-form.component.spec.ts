import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewTransactionalProfileFormComponent } from './new-transactional-profile-form.component';

describe('NewTransactionalProfileFormComponent', () => {
  let component: NewTransactionalProfileFormComponent;
  let fixture: ComponentFixture<NewTransactionalProfileFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewTransactionalProfileFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewTransactionalProfileFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
