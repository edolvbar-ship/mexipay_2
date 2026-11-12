import { TestBed } from '@angular/core/testing';

import { ContrachargesService } from './contracharges.service';

describe('ContrachargesService', () => {
  let service: ContrachargesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContrachargesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
