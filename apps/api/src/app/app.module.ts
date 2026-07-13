import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
// import { ConfigModule } from '@nestjs/config';

// Moduły platformowe (src/platform/*) i domenowe (src/domain/*) dochodzą tutaj
// dopiero, gdy dostaną realną implementację forRoot/forRootAsync — foldery
// już istnieją (patrz apps/api/src/platform, apps/api/src/domain), są puste.

@Module({
  imports: [
    EventEmitterModule.forRoot(), // wywoływane raz, tu — platform/ świadomie tego nie robi
    // ConfigModule.forRoot({ isGlobal: true }),
    // --- moduły platformowe, w miarę powstawania ---
    // AuthModule.forRootAsync({ useFactory: ..., inject: [ConfigService] }),
    // TenantsModule.forRoot({ ... }),
    // BillingModule.forRootAsync({ ... }),
    // --- moduły domenowe, w miarę powstawania ---
    // ContractsModule,
    // TemplatesModule,
  ],
})
export class AppModule {}
