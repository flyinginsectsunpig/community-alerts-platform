import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Skeleton Loader Component
 * Pulse animation for loading states.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div 
      className={twMerge(
        'animate-skeleton bg-surface2 rounded-md',
        className
      )} 
    />
  );
}
