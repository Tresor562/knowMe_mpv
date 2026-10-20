import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CreatorsModule } from '../creators/creators.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ReelsFeedController } from './reels-feed.controller';
import { ReelsFeedService } from './reels-feed.service';

@Module({ imports: [MediaModule, CreatorsModule], controllers: [PostsController, ReelsFeedController],
  providers: [PostsService, ReelsFeedService] })
export class PostsModule {}
