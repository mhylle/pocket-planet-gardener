import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { ClockService } from './clock.service';

// A full date and time with an explicit offset, so the instant does not
// depend on the server's time zone.
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Lets e2e tests set the time of a request with an X-Test-Now header (D-11).
 * Honoured only when NODE_ENV is test; anywhere else the header is ignored.
 */
@Injectable()
export class TestClockMiddleware implements NestMiddleware {
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('NODE_ENV') === 'test';
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const raw = req.headers['x-test-now'];
    if (!this.enabled || raw === undefined) {
      next();
      return;
    }

    const at =
      typeof raw === 'string' && ISO_TIMESTAMP.test(raw) ? new Date(raw) : null;
    if (!at || Number.isNaN(at.getTime())) {
      throw new BadRequestException('X-Test-Now must be an ISO timestamp');
    }
    ClockService.runAt(at, next);
  }
}
