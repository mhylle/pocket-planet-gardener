import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AiService } from '../../src/ai/ai.service';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { FakeAiService } from './fake-ai';

/**
 * Boots the whole app against the real database, with the fake model.
 * Extra controllers, such as a test-only probe, are mounted beside AppModule.
 */
export async function bootWithFakeAi(
  ai: FakeAiService,
  controllers: Type[] = [],
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    .overrideProvider(AiService)
    .useValue(ai)
    .compile();
  const app = configureApp(
    moduleRef.createNestApplication<INestApplication<App>>(),
  );
  await app.init();
  return app;
}
