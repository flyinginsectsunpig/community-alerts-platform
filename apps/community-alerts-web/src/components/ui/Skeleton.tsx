/**
 * Skeleton.tsx
 * FIX: Removed tailwind-merge import — not in package.json, causes build crash.
 * Simple className concatenation is sufficient here; no conflicting Tailwind
 * classes need merging. The shimmer gradient is applied via the .skeleton CSS
 * class in globals.css (not just the animation keyframe).
 */

interface Props {
  className?: string;
}

export function Skeleton({ className = '' }: Props) {
  return (
    <div className={`skeleton ${className}`} />
  );
}
