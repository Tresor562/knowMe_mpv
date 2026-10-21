import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CreatorsModule } from '../creators/creators.module';
import { PostsController } from './posts.controller';
import { SavedPostsController } from './saved-posts.controller';
import { SavedPostsService } from './saved-posts.service';
import { PostsService } from './posts.service';
import { ReelsFeedController } from './reels-feed.controller';
import { ReelsFeedService } from './reels-feed.service';

@Module({ imports: [MediaModule, CreatorsModule], controllers: [SavedPostsController, PostsController, ReelsFeedController],
  providers: [PostsService, SavedPostsService, ReelsFeedService] })
export class PostsModule {}
