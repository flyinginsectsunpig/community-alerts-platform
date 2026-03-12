'use client';

import { useState, useEffect } from 'react';
import { communityApi } from '@/lib/api';
import type { Incident } from '@/lib/types';

export function useIncidentComments(
  incident: Incident,
  onUpdateIncident: (id: number | string, updater: (current: Incident) => Incident) => void,
) {
  const [comment, setComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (!incident.isFromBackend || incident.comments.length > 0 || incident.commentCount === 0) return;
    if (typeof incident.id !== 'number') return;

    let cancelled = false;
    setLoadingComments(true);
    communityApi.getIncidentComments(incident.id)
      .then((rows: any) => {
        if (cancelled) return;
        const comments = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          user: row.username ?? 'Resident',
          avatar: '#3b82f6',
          time: row.createdAt ? new Date(row.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown',
          text: row.text ?? '',
        }));
        onUpdateIncident(incident.id, (current) => ({
          ...current,
          comments,
          commentCount: Math.max(current.commentCount, comments.length),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [incident.id, incident.isFromBackend, incident.commentCount, incident.comments.length, onUpdateIncident]);

  async function submitComment() {
    const text = comment.trim();
    if (!text) return;

    onUpdateIncident(incident.id, (current) => ({
      ...current,
      comments: [...current.comments, { user: 'You', avatar: '#3b82f6', time: 'Just now', text }],
      commentCount: current.commentCount + 1,
    }));
    setComment('');

    if (!incident.isFromBackend || typeof incident.id !== 'number') return;
    try {
      await communityApi.addIncidentComment(incident.id, {
        username: 'You',
        text,
        descriptionMatch: false,
      });
    } catch {
      // Keep optimistic update in UI even if backend write fails.
    }
  }

  return { comment, setComment, loadingComments, submitComment };
}
