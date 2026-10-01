import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClockService } from './clock.service';
import { RandomService } from './random.service';
import { TestClockMiddleware } from './test-clock.middleware';

// Global so every feature module can inject the clock and the randomness
// without importing this module.
@Global()
@Module({
  providers: [ClockService, RandomService],
  exports: [ClockService, RandomService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TestClockMiddleware).forRoutes('*');
  }
}
