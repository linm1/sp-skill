/**
 * Format timestamp as relative time for recent dates, absolute date for older dates
 *
 * @param timestamp - ISO string or Date object
 * @returns Formatted string (e.g., "2 hours ago", "yesterday", "Dec 29, 2024")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle edge case: future dates (shouldn't happen but handle gracefully)
  if (diffMs < 0) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // < 1 minute
  if (diffMinutes < 1) return "just now";

  // 1-59 minutes
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;

  // 1-23 hours
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  // Exactly 1 day
  if (diffDays === 1) return "yesterday";

  // 2-6 days
  if (diffDays < 7) return `${diffDays} days ago`;

  // 7+ days: Show absolute date (e.g., "Dec 29, 2024")
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
