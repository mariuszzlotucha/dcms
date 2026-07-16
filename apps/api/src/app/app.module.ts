import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/config.schema';
import { HealthModule } from '@platform/health';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    EventEmitterModule.forRoot(), 
HealthModule.forRoot(),
  ],
})
export class AppModule {}
