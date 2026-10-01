import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * The HTTP configuration shared by main.ts and the e2e tests, so the tests
 * exercise the same prefix and validation rules as the running server.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  // All routes live under /api so the frontend can proxy a single prefix.
  app.setGlobalPrefix('api');

  // Reject payloads that do not match the DTOs, and strip unknown properties.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
