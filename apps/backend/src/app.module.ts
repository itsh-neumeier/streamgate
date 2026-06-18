import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './controllers/admin.controller';
import { ApiController } from './controllers/api.controller';
import { HealthController } from './controllers/health.controller';
import { StreamGateService } from './services/streamgate.service';
import { TvheadendConnectorClient } from './services/tvheadend-connector.client';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, ApiController, AdminController],
  providers: [StreamGateService, TvheadendConnectorClient]
})
export class AppModule {}
