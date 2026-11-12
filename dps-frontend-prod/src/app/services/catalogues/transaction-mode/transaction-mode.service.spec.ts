import { TestBed } from '@angular/core/testing';

import { TransactionModeService } from './transaction-mode.service';

describe('LogicalNetworksService', () => {
  let service: TransactionModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransactionModeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
