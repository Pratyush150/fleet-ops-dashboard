import { useCallback, useEffect, useRef, useState } from 'react';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Measures an element with ResizeObserver. Used by the map so the viewBox
 * aspect ratio matches the rendered box at every breakpoint without a
 * fixed-size container.
 */
export function useElementSize<T extends Element>(): [
  (node: T | null) => void,
  Size,
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    nodeRef.current = node;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(node);
    observerRef.current = observer;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, size];
}
