import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({ imports: [MediaModule], controllers: [PostsController], providers: [PostsService] })
export class PostsModule {}
