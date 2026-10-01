import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageReloadService } from './page-reload.service';

describe('PageReloadService', () => {
  it('reloads the document location', () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { location: { reload } } }],
    });

    TestBed.inject(PageReloadService).reload();

    expect(reload).toHaveBeenCalledOnce();
  });
});
