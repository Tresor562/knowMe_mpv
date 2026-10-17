'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { storyUi } from '../stories/story-i18n';
import { KnowMeAvatarImage } from '../../components/knowme-avatar-image';
import { AccountBadges } from '../../components/AccountBadges';
import type { VerificationBadge } from '../../lib/use-session';
import { groupStoriesByAuthor, type StoryAuthorGroup } from './story-rail-model';
import './StoriesRail.css';

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
    verification?: VerificationBadge | null;
  } | null;
  viewer: { own: boolean; reaction?: unknown };
};

type StoryFeedResponse = {
  stories: Story[];
  nextCursor: string | null;
};
type StoryRailResponse = {
  groups: StoryAuthorGroup<Story>[];
  nextOffset: number | null;
};

/**
 * Stories remain ACL-protected: request through the authenticated Story
 * endpoint, NEVER embed raw private media URLs in the DOM. Only photos are
 * prefetched here. The current API does not expose a thumbnail endpoint for
 * videos, so a video card uses the author's avatar until that API exists.
 */
function StoryCover({ story, avatarUrl, name }: {
  story?: Story;
  avatarUrl?: string | null;
  name: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [story?.id]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewUrl(null);
    if (!visible || !story || story.type !== 'PHOTO' || !story.assetId ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

    void apiFetchBlob(`/stories/${encodeURIComponent(story.id)}/media`)
      .then(blob => {
        if (cancelled || !blob.type.startsWith('image/')) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => undefined); // Keep the avatar fallback on network/ACL error.

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [story?.id, story?.assetId, story?.type, visible]);

  return (
    <div ref={element} className="km-story-card-cover" aria-hidden="true">
      {previewUrl
        ? <img src={previewUrl} alt="" loading="lazy" />
        : <KnowMeAvatarImage src={avatarUrl} name={name}/>}
    </div>
  );
}

export function StoriesRail() {
  const ui = storyUi();
  const { user } = useSession();
  const [groups, setGroups] = useState<StoryAuthorGroup<Story>[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const paginationPending = useRef(false);
  const railRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      try {
        const response = await apiFetch<StoryRailResponse>('/stories/rail');
        setGroups(response.groups);
        setNextOffset(response.nextOffset);
      } catch (cause) {
        // During gradual Web/API rollout, keep legacy clients functional.
        if ((cause as { status?: number })?.status !== 404) throw cause;
        const legacy = await apiFetch<StoryFeedResponse>('/stories/feed');
        setGroups(groupStoriesByAuthor(legacy.stories));
        setNextOffset(null);
      }
    } catch (cause) {
      setGroups([]);
      setNextOffset(null);
      setError(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      setLoading(false);
    }
  }, [ui.unavailable]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || paginationPending.current) return;
    paginationPending.current = true;
    setLoadingMore(true);
    try {
      const response = await apiFetch<StoryRailResponse>(`/stories/rail?offset=${nextOffset}`);
      setGroups(current => {
        const existing = new Set(current.map(item => item.story.author?.id).filter(Boolean));
        return [...current, ...response.groups.filter(item =>
          item.story.author?.id && !existing.has(item.story.author.id)
        )];
      });
      setNextOffset(response.nextOffset);
    } catch (cause) {
      // Keep the existing rail intact if the next page cannot be loaded.
      setError(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      paginationPending.current = false;
      setLoadingMore(false);
    }
  }, [nextOffset, ui.unavailable]);

  useEffect(() => {
    if (nextOffset === null || !railRef.current || !sentinelRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(item => item.isIntersecting)) void loadMore();
    }, { root: railRef.current, rootMargin: '0px 160px 0px 0px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, nextOffset, groups.length]);

  const myGroup = groups.find(group => group.story.viewer.own);
  const otherGroups = groups.filter(group => !group.story.viewer.own);

  return (
    <section className="km-stories" aria-label={ui.stories}>
      <div className="km-stories-heading">
        <h2>{ui.stories}</h2>
        <Link href="/stories/new" className="km-stories-all">{ui.createStory}</Link>
      </div>
      <div ref={railRef} className="km-stories-rail km-story-card-rail">
        <div className="km-story-card" data-story-owner="true">
          <StoryCover story={myGroup?.story} avatarUrl={user?.avatarUrl} name={user?.displayName ?? '?'} />
          <Link className="km-story-card-open"
            href={myGroup ? `/stories/${myGroup.story.id}` : '/stories/new'}
            aria-label={myGroup ? `${ui.yourStory} (${myGroup.count})` : ui.createStory}>
            {myGroup && myGroup.count > 1 && <span className="km-story-card-count">{myGroup.count}</span>}
            <span className="km-story-card-label">{myGroup ? ui.yourStory : ui.createStory}</span>
          </Link>
          <Link href="/stories/new" className="km-story-card-add" aria-label={ui.createStory}>+</Link>
        </div>

        {loading && Array.from({ length: 3 }).map((_, index) => (
          <div className="km-story-card km-story-card-loading" key={index} aria-hidden="true"/>
        ))}

        {!loading && !error && otherGroups.map(({ story, count }) => (
          <div className="km-story-card" key={story.author!.id}>
            <StoryCover story={story} avatarUrl={story.author?.avatarUrl}
              name={story.author?.displayName ?? 'KnowMe'}/>
            <Link href={`/stories/${story.id}`} className="km-story-card-open"
              aria-label={`${story.author?.displayName ?? 'KnowMe'} · ${count} ${ui.stories}`}>
              {count > 1 && <span className="km-story-card-count">{count}</span>}
              <span className="km-story-card-label">
                {story.author?.displayName ?? 'KnowMe'}
                {story.author?.username && <AccountBadges username={story.author.username}
                  verification={story.author.verification} compact/>}
              </span>
            </Link>
          </div>
        ))}
        {nextOffset !== null && (
          <div ref={sentinelRef} className="km-story-card km-story-card-loading"
            aria-label={loadingMore ? (ui.loading) : undefined}
            aria-hidden="true" />
        )}
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
