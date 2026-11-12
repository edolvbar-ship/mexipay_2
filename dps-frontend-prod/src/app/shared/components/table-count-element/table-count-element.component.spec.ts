import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableCountElementComponent } from './table-count-element.component';

describe('TableCountElementComponent', () => {
  let component: TableCountElementComponent;
  let fixture: ComponentFixture<TableCountElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableCountElementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TableCountElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
