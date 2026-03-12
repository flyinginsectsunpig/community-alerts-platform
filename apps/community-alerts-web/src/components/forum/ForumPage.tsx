'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { FALLBACK_SUBURBS } from '@/lib/data/fallback';
import { clsx } from 'clsx';
import { Plus, Send } from 'lucide-react';
import type { ForumPost } from '@/lib/types';
import { PostCard } from './PostCard';

export function ForumPage() {
  const { suburbs, forumPosts, setForumPosts, activeForumSuburb, setActiveForumSuburb } = useStore();
  const [newPost, setNewPost] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const allSuburbs = suburbs.length ? suburbs : FALLBACK_SUBURBS;
  const currentPosts = forumPosts[activeForumSuburb] ?? [];
  const activeSuburb = allSuburbs.find((s) => s.id === activeForumSuburb);

  function handleLike(suburbId: string, idx: number) {
    const updated = { ...forumPosts };
    const posts = [...(updated[suburbId] ?? [])];
    posts[idx] = {
      ...posts[idx],
      liked: !posts[idx].liked,
      likes: posts[idx].likes + (posts[idx].liked ? -1 : 1),
    };
    updated[suburbId] = posts;
    setForumPosts(updated);
  }

  function handlePost() {
    if (!newPost.trim()) return;
    const names = ['Anonymous', 'ResidentCT', 'WatchDog', 'SafetyFirst', 'LocalHero'];
    const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444'];
    const idx = Math.floor(Math.random() * names.length);

    const newEntry: ForumPost = {
      user: names[idx],
      avatar: colors[idx],
      time: 'Just now',
      text: newPost.trim(),
      likes: 0,
      liked: false,
    };

    const updated = {
      ...forumPosts,
      [activeForumSuburb]: [newEntry, ...(forumPosts[activeForumSuburb] ?? [])],
    };
    setForumPosts(updated);
    setNewPost('');
    setShowCompose(false);
  }

  function handleReply(suburbId: string, idx: number, text: string) {
    const updated = { ...forumPosts };
    const posts = [...(updated[suburbId] ?? [])];
    if (!posts[idx]) return;

    const replies = [...(posts[idx].replies ?? [])];
    replies.push({
      user: 'You',
      avatar: '#3b82f6',
      time: 'Just now',
      text,
      likes: 0,
      liked: false,
    });

    posts[idx] = {
      ...posts[idx],
      replies,
    };
    updated[suburbId] = posts;
    setForumPosts(updated);
  }

  // Total post count per suburb
  const postCounts = allSuburbs.reduce((acc, s) => {
    acc[s.id] = (forumPosts[s.id] ?? []).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Suburb sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-border bg-surface overflow-y-auto">
        <div className="p-3 border-b border-border">
          <div className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Suburb Boards</div>
        </div>
        <div className="py-1">
          {allSuburbs.map((suburb) => {
            const count = postCounts[suburb.id] ?? 0;
            const active = suburb.id === activeForumSuburb;
            return (
              <button
                key={suburb.id}
                onClick={() => setActiveForumSuburb(suburb.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  active ? 'bg-accent/10 border-r-2 border-accent' : 'hover:bg-surface2',
                )}
              >
                <span className={clsx('font-body text-sm flex-1 truncate', active ? 'text-accent font-semibold' : 'text-text-secondary')}>
                  {suburb.name}
                </span>
                {count > 0 && (
                  <span className="font-mono text-[10px] text-text-dim">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main forum content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="badge-mono mb-1">Community Board</div>
            <h1 className="font-display font-bold text-lg">{activeSuburb?.name ?? 'Forum'}</h1>
            <div className="font-mono text-[10px] text-text-dim mt-0.5">{currentPosts.length} posts</div>
          </div>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="btn-primary text-sm"
          >
            <Plus size={14} />
            New Post
          </button>
        </div>

        {/* Compose box */}
        {showCompose && (
          <div className="flex-shrink-0 mx-5 mt-4 card p-4 animate-slide-up">
            <div className="form-label">Post to {activeSuburb?.name}</div>
            <textarea
              className="form-input resize-none mb-3"
              rows={3}
              placeholder="Share a safety update, ask a question, or start a discussion..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost text-xs" onClick={() => setShowCompose(false)}>Cancel</button>
              <button
                className={clsx('btn-primary text-xs gap-1', !newPost.trim() && 'opacity-50 cursor-not-allowed')}
                onClick={handlePost}
                disabled={!newPost.trim()}
              >
                <Send size={11} /> Post
              </button>
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="flex-1 overflow-y-auto p-5">
          {currentPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">💬</div>
              <div className="font-display font-bold text-text-secondary">No posts yet</div>
              <div className="font-body text-sm text-text-dim mt-1">Be the first to post in {activeSuburb?.name}</div>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {currentPosts.map((post, i) => (
                <PostCard
                  key={i}
                  post={post}
                  onLike={() => handleLike(activeForumSuburb, i)}
                  onReply={(text) => handleReply(activeForumSuburb, i, text)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
