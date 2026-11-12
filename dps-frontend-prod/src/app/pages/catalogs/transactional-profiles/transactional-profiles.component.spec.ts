import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionalProfilesComponent } from './transactional-profiles.component';

describe('TransactionalProfilesComponent', () => {
  let component: TransactionalProfilesComponent;
  let fixture: ComponentFixture<TransactionalProfilesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionalProfilesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionalProfilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
