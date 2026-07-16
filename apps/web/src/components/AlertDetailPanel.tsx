"use client";

import { useEffect, useState } from "react";

import SeverityBadge from "./SeverityBadge";
import { api, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/auth";
import { CATEGORY_LABELS, timeAgo } from "@/lib/format";
import type { Alert, AlertComment } from "@/lib/types";

interface AlertDetailPanelProps {
  alert: Alert;
  session: AuthSession | null;
  /** Latest live comment event, forwarded from the SSE stream. */
  liveComment: AlertComment | null;
  onClose: () => void;
  onConfirm: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  onRequestAuth: () => void;
}

export default function AlertDetailPanel({
  alert,
  session,
  liveComment,
  onClose,
  onConfirm,
  onResolve,
  onRequestAuth,
}: AlertDetailPanelProps) {
  const [comments, setComments] = useState<AlertComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the panel, matching the modal dialogs elsewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // A modal dialog or the zone editor stacked above owns Escape while open.
      if (document.querySelector(".panel-overlay, .zone-panel")) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    api
      .fetchComments(alert.id)
      .then((thread) => {
        if (!cancelled) setComments(thread);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [alert.id]);

  // Append live comments from other viewers, deduplicating by id.
  useEffect(() => {
    if (!liveComment || liveComment.alertId !== alert.id) {
      return;
    }
    setComments((current) => {
      if (current === null || current.some((c) => c.id === liveComment.id)) {
        return current;
      }
      return [...current, liveComment];
    });
  }, [liveComment, alert.id]);

  async function handlePost(event: React.FormEvent) {
    event.preventDefault();
    if (!session) {
      onRequestAuth();
      return;
    }
    setError(null);
    setPosting(true);
    try {
      const created = await api.addComment(alert.id, draft.trim());
      setComments((current) =>
        current === null || current.some((c) => c.id === created.id)
          ? current
          : [...current, created],
      );
      setDraft("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onRequestAuth();
      } else {
        setError(e instanceof ApiError ? e.message : "Could not post the update — try again");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <aside className="detail-panel" aria-label="Alert details and discussion">
      <div className="detail-panel__header">
        <div>
          <strong>{CATEGORY_LABELS[alert.category]}</strong>
          <div className="detail-panel__badges">
            <SeverityBadge severity={alert.severity} />
            {alert.status === "VERIFIED" && <span className="verified-chip">✓ Verified</span>}
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>

      <p className="detail-panel__description">{alert.description}</p>

      <div className="detail-panel__meta">
        <span>{timeAgo(alert.createdAt)}</span>
        {alert.riskScore !== null && <span>risk {(alert.riskScore * 100).toFixed(0)}%</span>}
        <span>
          {alert.confirmationCount} confirmation{alert.confirmationCount === 1 ? "" : "s"}
        </span>
        <button type="button" className="btn btn--small" onClick={() => onConfirm(alert.id)}>
          I saw this too
        </button>
        {session && session.userId === alert.reportedByUserId && (
          <button type="button" className="btn btn--small" onClick={() => onResolve(alert.id)}>
            Mark resolved
          </button>
        )}
      </div>

      <h3 className="detail-panel__thread-title">
        Updates {comments !== null && comments.length > 0 && `(${comments.length})`}
      </h3>

      <div className="detail-panel__thread">
        {comments === null ? (
          <div className="comment-skeleton" aria-hidden>
            <div className="skeleton comment-skeleton__item" />
            <div className="skeleton comment-skeleton__item" />
          </div>
        ) : comments.length === 0 ? (
          <p className="feed__empty">
            No updates yet. Saw something — a direction, a description, a vehicle? Add it here.
          </p>
        ) : (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment">
                <div className="comment__meta">
                  <strong>{comment.authorName}</strong>
                  <span>{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="comment__body">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="comment-composer" onSubmit={handlePost}>
        {session ? (
          <>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add what you saw… (e.g. wearing a yellow sweater, headed north)"
              rows={2}
              minLength={2}
              maxLength={1000}
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn btn--primary btn--small"
              disabled={posting || draft.trim().length < 2}
            >
              {posting ? "Posting…" : `Post as ${session.displayName}`}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--small" onClick={onRequestAuth}>
            Sign in to add an update
          </button>
        )}
      </form>
    </aside>
  );
}
