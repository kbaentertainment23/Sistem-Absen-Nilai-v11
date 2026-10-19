import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyListOptions {
  initialCount?: number;
  batchSize?: number;
}

export function useLazyList<T>(items: T[], options: UseLazyListOptions = {}) {
  const { initialCount = 40, batchSize = 40 } = options;
  const [visibleCount, setVisibleCount] = useState<number>(initialCount);
  const sentinelRef = useRef<any>(null);

  // Reset visible count whenever items list reference or length changes
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => {
      if (prev >= items.length) return prev;
      return Math.min(prev + batchSize, items.length);
    });
  }, [batchSize, items.length]);

  const loadAll = useCallback(() => {
    setVisibleCount(items.length);
  }, [items.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [loadMore, visibleCount, items.length]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return {
    visibleItems,
    visibleCount,
    totalCount: items.length,
    hasMore,
    loadMore,
    loadAll,
    sentinelRef,
  };
}
