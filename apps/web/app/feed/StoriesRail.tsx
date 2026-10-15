'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { storyUi } from '../stories/story-i18n';
import { KnowMeAvatarImage } from '../../components/knowme-avatar-image';

type Story = {
  id: string;
  type: string;
  assetId?: string | null;
  thumbnailAssetId?: string | null;
  caption?: string | null;
  expiresAt?: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  viewer: { own: boolean; reaction?: unknown };
};

type StoryFeedResponse = {
  stories: Story[];
  nextCursor: string | null;
};

export function StoriesRail() {
  const ui = storyUi();
  const { user } = useSession();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<StoryFeedResponse>('/stories/feed');
      setStories(response.stories);
    } catch (cause) {
      setStories([]);
      setError(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      setLoading(false);
    }
  }, [ui.unavailable]);

  useEffect(() => {
    void load();
  }, [load]);

  const myStory = stories.find(story => story.viewer.own);
  const others = stories.filter(story => !story.viewer.own && story.author);

  return (
    <section className="km-stories" aria-label={ui.stories}>
      <div className="km-stories-heading">
        <h2>{ui.stories}</h2>
        <Link href="/stories/new" className="km-stories-all">{ui.createStory}</Link>
      </div>
      <div className="km-stories-rail">
        <div className="km-story-tile km-story-self">
          <Link className={'km-story-avatar' + (myStory ? ' has-story' : '')}
            href={myStory ? `/stories/${myStory.id}` : '/stories/new'}
            aria-label={myStory ? ui.yourStory : ui.createStory}>
            <KnowMeAvatarImage src={user?.avatarUrl} name={user?.displayName ?? '?'} />
          </Link>
          <Link className="km-story-add" href="/stories/new" aria-label={ui.createStory}>+</Link>
          <small>{ui.yourStory}</small>
        </div>

        {loading && Array.from({ length: 4 }).map((_, index) => (
          <div className="km-story-tile" key={index} aria-hidden="true">
            <div className="km-story-avatar km-story-skeleton" />
            <small className="km-story-skeleton-label" />
          </div>
        ))}

        {!loading && !error && others.map(story => (
          <div className="km-story-tile" key={story.id}>
            <Link href={`/stories/${story.id}`} className="km-story-avatar has-story"
              aria-label={`Voir la story de ${story.author?.displayName ?? 'KnowMe'}`}>
              <KnowMeAvatarImage src={story.author?.avatarUrl} name={story.author?.displayName ?? '?'} />
            </Link>
            {story.author?.username
              ? <Link className="km-story-profile-label"
                  href={`/profile/${encodeURIComponent(story.author.username)}`}>
                  <small>{story.author.displayName}</small>
                </Link>
              : <small>{ui.stories}</small>}
          </div>
        ))}
      </div>
      {!loading && error && (
        <div className="km-stories-error" role="status">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>{ui.retry}</button>
        </div>
      )}
    </section>
  );
}
