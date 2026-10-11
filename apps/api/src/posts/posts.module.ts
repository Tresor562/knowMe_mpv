import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PostAttachmentsController } from './post-attachments.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [MediaModule],
  controllers: [PostsController, PostAttachmentsController],
  providers: [PostsService]
})
export class PostsModule {}
