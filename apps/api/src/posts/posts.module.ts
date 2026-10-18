import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PostsController } from './posts.controller';
import { PostLikeStatusController } from './post-like-status.controller';
import { PostsService } from './posts.service';

@Module({ imports: [MediaModule], controllers: [PostLikeStatusController, PostsController], providers: [PostsService] })
export class PostsModule {}
