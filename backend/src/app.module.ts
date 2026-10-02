import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { ChatModule } from './chat/chat.module';
import { CommonModule } from './common/common.module';
import { CreaturesModule } from './creatures/creatures.module';
import { EventsModule } from './events/events.module';
import { GameConfigModule } from './game-config/game-config.module';
import { GardenModule } from './garden/garden.module';
import { InventoryModule } from './inventory/inventory.module';
import { PlanetsModule } from './planets/planets.module';
import { SimulationModule } from './simulation/simulation.module';
import { WantsModule } from './wants/wants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'app'),
        autoLoadEntities: true,
        // The schema is owned by migrations; the app never alters it.
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
      }),
    }),
    CommonModule,
    GameConfigModule,
    CatalogueModule,
    PlanetsModule,
    GardenModule,
    InventoryModule,
    SimulationModule,
    EventsModule,
    AdminModule,
    AiModule,
    CreaturesModule,
    WantsModule,
    ChatModule,
  ],
})
export class AppModule {}
