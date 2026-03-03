export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char];
  });
}

export function heatColor(weight) {
  if (weight >= 30) return '#ef4444';
  if (weight >= 20) return '#f97316';
  if (weight >= 12) return '#eab308';
  return '#22c55e';
}

export function heatClass(weight) {
  if (weight >= 30) return 'red';
  if (weight >= 20) return 'orange';
  if (weight >= 12) return 'yellow';
  return 'green';
}

export function heatTrend(weight) {
  if (weight >= 30) return { cls: 'up', txt: '↑ High' };
  if (weight >= 20) return { cls: 'up', txt: '↑ Mod' };
  if (weight >= 12) return { cls: 'flat', txt: '→ Low' };
  return { cls: 'down', txt: '↓ Safe' };
}

export function formatRelativeTime(isoDateTime) {
  if (!isoDateTime) return 'Just now';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
