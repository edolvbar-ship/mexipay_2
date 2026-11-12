import { TestBed } from '@angular/core/testing';

import { CloseInactivityService } from './close-inactivity.service';

describe('CloseInactivityService', () => {
  let service: CloseInactivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CloseInactivityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
