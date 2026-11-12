import { TestBed } from '@angular/core/testing';

import { DataMaskerService } from './data-masker.service';

describe('DataMaskerService', () => {
  let service: DataMaskerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataMaskerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
