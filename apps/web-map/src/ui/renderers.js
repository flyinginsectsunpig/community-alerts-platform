import { escapeHtml, heatClass, heatTrend } from '../utils/format.js';

export function renderSuburbList(container, suburbs) {
  const sorted = [...suburbs].sort((a, b) => b.weight - a.weight);
  container.innerHTML = sorted
    .map((suburb) => {
      const trend = heatTrend(suburb.weight);
      const cls = heatClass(suburb.weight);
      return `
        <div class="suburb-item" data-suburb="${suburb.id}">
          <div class="heat-dot ${cls}"></div>
          <div class="suburb-name">${escapeHtml(suburb.name)}</div>
          <span class="suburb-count">${suburb.weight}</span>
          <span class="suburb-trend ${trend.cls}">${trend.txt}</span>
        </div>
      `;
    })
    .join('');
}

export function updateStats({ incidents, statCrimeEl, statTotalEl, statSuburbsEl }) {
  const crimes = incidents.filter((incident) => incident.type === 'crime').length;
  statCrimeEl.textContent = crimes;
  statTotalEl.textContent = incidents.length;
  statSuburbsEl.textContent = new Set(incidents.map((incident) => incident.suburb)).size;
}

export function renderIncidentPanel({ incident, suburbName, panelElements, typeConfig }) {
  const cfg = typeConfig[incident.type];
  const badge = panelElements.badge;

  badge.textContent = `${cfg.emoji} ${cfg.label}`;
  badge.style.background = `${cfg.color}22`;
  badge.style.color = cfg.color;
  badge.style.border = `1px solid ${cfg.color}55`;

  panelElements.title.textContent = incident.title;
  panelElements.meta.textContent = `${incident.time} · ${suburbName} · Severity ${incident.severity}/5`;

  const tagsHtml = (incident.tags || []).map((tag) => `<span class="suspect-tag">${escapeHtml(tag)}</span>`).join('');
  const commentsHtml = (incident.comments || [])
    .map(
      (comment) => `
      <div class="comment">
        <div class="comment-header">
          <div class="comment-avatar" style="background:${comment.avatar}33;color:${comment.avatar}">${escapeHtml(comment.user[0] || 'U')}</div>
          <span class="comment-user">${escapeHtml(comment.user)}</span>
          <span class="comment-time">${escapeHtml(comment.time)}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        ${comment.match ? '<span class="comment-match">🔴 DESCRIPTION MATCH</span>' : ''}
      </div>
    `,
    )
    .join('');

  panelElements.body.innerHTML = `
    <div>
      <div class="panel-section-title">Description</div>
      <div class="description-box">${escapeHtml(incident.description)}</div>
    </div>
    ${incident.tags?.length ? `<div><div class="panel-section-title">Tags / Identifiers</div><div class="suspect-tags">${tagsHtml}</div></div>` : ''}
    <div>
      <div class="panel-section-title">Community Comments (${incident.comments?.length || 0})</div>
      <div class="comments" id="commentsList">${commentsHtml || '<div class="comment-text">No comments yet.</div>'}</div>
    </div>
  `;

  panelElements.panel.classList.add('open');
}

export function renderForum({ forumTabsEl, forumThreadEl, suburbs, forumPosts, activeForumSuburb }) {
  const suburbsWithPosts = suburbs.filter((suburb) => forumPosts[suburb.id]);

  forumTabsEl.innerHTML = suburbsWithPosts
    .map(
      (suburb) => `<div class="forum-tab ${suburb.id === activeForumSuburb ? 'active' : ''}" data-forum-tab="${suburb.id}">${escapeHtml(suburb.name)}</div>`,
    )
    .join('');

  const posts = forumPosts[activeForumSuburb] || [];
  forumThreadEl.innerHTML = posts
    .map(
      (post, index) => `
        <div class="forum-post">
          <div class="forum-post-header">
            <div class="comment-avatar" style="background:${post.avatar}33;color:${post.avatar};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${escapeHtml(post.user[0])}</div>
            <span class="forum-post-user">${escapeHtml(post.user)}</span>
            <span class="forum-post-time">${escapeHtml(post.time)}</span>
          </div>
          <div class="forum-post-text">${escapeHtml(post.text)}</div>
          <div class="forum-post-actions">
            <button class="forum-action ${post.liked ? 'liked' : ''}" data-forum-action="like" data-forum-suburb="${activeForumSuburb}" data-forum-idx="${index}">${post.liked ? '❤️' : '🤍'} ${post.likes}</button>
            <button class="forum-action" data-forum-action="reply" data-forum-user="${encodeURIComponent(post.user)}">↩ Reply</button>
          </div>
        </div>
      `,
    )
    .join('');

  if (!posts.length) {
    forumThreadEl.innerHTML = '<div style="text-align:center;color:var(--text-dim);font-family:\'Space Mono\',monospace;font-size:11px;padding:24px">No posts yet. Be the first.</div>';
  }
}
