import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeadLetterEntry } from './entities/dead-letter-entry.entity';
import { DeadLetterQueueService } from './dead-letter-queue.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DeadLetterEntry])],
  providers: [DeadLetterQueueService],
  exports: [DeadLetterQueueService],
})
export class DeadLetterQueueModule {}
