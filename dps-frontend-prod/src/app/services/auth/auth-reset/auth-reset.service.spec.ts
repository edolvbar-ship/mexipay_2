import { TestBed } from '@angular/core/testing';

import { AuthResetService } from './auth-reset.service';

describe('AuthResetService', () => {
  let service: AuthResetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthResetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
