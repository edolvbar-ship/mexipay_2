import { TestBed } from '@angular/core/testing';

import { LogicalNetworksService } from './logical-networks.service';

describe('LogicalNetworksService', () => {
  let service: LogicalNetworksService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogicalNetworksService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
