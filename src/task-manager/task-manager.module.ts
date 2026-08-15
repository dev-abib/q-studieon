import { Module } from '@nestjs/common';
import { TaskManagerController } from './task-manager.controller';
import { TaskManagerService } from './task-manager.service';

import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [TaskManagerController],
  providers: [TaskManagerService],
})
export class TaskManagerModule {}
