import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkTypesComponent } from './url-target.component';

describe('NetworkTypesComponent', () => {
  let component: NetworkTypesComponent;
  let fixture: ComponentFixture<NetworkTypesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkTypesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkTypesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
