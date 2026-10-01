import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));

  // The Angular dev server runs on a different origin.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4301',
  });

  await app.listen(process.env.PORT ?? 3101);
}
void bootstrap();
