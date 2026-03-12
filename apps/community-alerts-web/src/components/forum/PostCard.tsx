'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Heart, MessageSquare } from 'lucide-react';
import type { ForumPost } from '@/lib/types';

interface Props {
  post: ForumPost;
  onLike: () => void;
  onReply: (text: string) => void;
}

export function PostCard({ post, onLike, onReply }: Props) {
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  function submitReply() {
    const text = replyText.trim();
    if (!text) return;
    onReply(text);
    setReplyText('');
    setShowReplyBox(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
          style={{ background: post.avatar }}
        >
          {post.user[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-sm text-text-primary">{post.user}</span>
            <span className="font-mono text-[10px] text-text-dim">{post.time}</span>
          </div>
          <p className="font-body text-sm text-text-secondary mt-1 leading-relaxed">{post.text}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-border/50">
        <button
          onClick={onLike}
          className={clsx(
            'flex items-center gap-1.5 font-mono text-[11px] transition-colors',
            post.liked ? 'text-red' : 'text-text-dim hover:text-red',
          )}
        >
          <Heart size={12} fill={post.liked ? 'currentColor' : 'none'} />
          {post.likes}
        </button>
        <button
          className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim hover:text-accent transition-colors"
          onClick={() => setShowReplyBox((v) => !v)}
        >
          <MessageSquare size={12} />
          Reply
        </button>
      </div>

      {showReplyBox && (
        <div className="pt-1 border-t border-border/50 space-y-2">
          <input
            className="form-input text-xs"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitReply();
              }
            }}
          />
          <div className="flex justify-end">
            <button
              className={clsx('btn-primary text-xs px-2 py-1', !replyText.trim() && 'opacity-50 cursor-not-allowed')}
              onClick={submitReply}
              disabled={!replyText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {(post.replies ?? []).length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/50">
          {(post.replies ?? []).map((reply, i) => (
            <div key={i} className="bg-surface2/70 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0"
                  style={{ background: reply.avatar }}
                >
                  {reply.user[0]}
                </div>
                <span className="font-mono text-[10px] text-text-secondary">{reply.user}</span>
                <span className="font-mono text-[10px] text-text-dim ml-auto">{reply.time}</span>
              </div>
              <p className="font-body text-xs text-text-secondary">{reply.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
