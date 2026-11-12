import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewNetworkFormComponent } from './new-network-form.component';

describe('NewNetworkFormComponent', () => {
  let component: NewNetworkFormComponent;
  let fixture: ComponentFixture<NewNetworkFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewNetworkFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewNetworkFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
