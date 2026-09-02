import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { Size } from './useElementSize';
import { clamp } from '../lib/math';

export interface Viewport {
  /** Centre of the view in world metres. */
  readonly cx: number;
  readonly cy: number;
  /** Width of the view in world metres. Height follows the element aspect. */
  readonly spanX: number;
}

export interface MapViewportApi {
  readonly viewport: Viewport;
  readonly viewBox: string;
  readonly isPanning: boolean;
  readonly zoomBy: (factor: number) => void;
  readonly resetView: () => void;
  readonly centreOn: (x: number, y: number) => void;
  readonly onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
}

const MIN_SPAN_M = 120;
const MAX_SPAN_M = 6000;

/**
 * Pan and zoom implemented directly on the SVG viewBox.
 *
 * No map library. Pointer deltas are converted from CSS pixels to world metres
 * using the current span and the measured element width, so a drag tracks the
 * cursor exactly at any zoom level. The measured size comes from the caller so
 * the viewBox aspect ratio is always the one being rendered this frame.
 */
export function useMapViewport(initial: Viewport, size: Size): MapViewportApi {
  const [viewport, setViewport] = useState<Viewport>(initial);
  const [isPanning, setIsPanning] = useState(false);
  const sizeRef = useRef<Size>(size);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  sizeRef.current = size.width > 0 && size.height > 0 ? size : sizeRef.current;

  const zoomBy = useCallback((factor: number) => {
    setViewport((v) => ({ ...v, spanX: clamp(v.spanX * factor, MIN_SPAN_M, MAX_SPAN_M) }));
  }, []);

  const resetView = useCallback(() => setViewport(initial), [initial]);

  const centreOn = useCallback((x: number, y: number) => {
    setViewport((v) => ({ ...v, cx: x, cy: y }));
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dxPx = event.clientX - drag.x;
    const dyPx = event.clientY - drag.y;
    dragRef.current = { id: drag.id, x: event.clientX, y: event.clientY };
    setViewport((v) => {
      const metresPerPx = v.spanX / Math.max(1, sizeRef.current.width);
      // Screen y is inverted relative to the ENU north axis.
      return { ...v, cx: v.cx - dxPx * metresPerPx, cy: v.cy + dyPx * metresPerPx };
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    setViewport((v) => ({ ...v, spanX: clamp(v.spanX * factor, MIN_SPAN_M, MAX_SPAN_M) }));
  }, []);

  const aspect = sizeRef.current.height / Math.max(1, sizeRef.current.width);
  // `sizeRef` starts at the caller's first measurement, which may be zero on
  // the very first paint; fall back to a sane landscape aspect until then.
  const spanY = viewport.spanX * (aspect > 0 ? aspect : 0.62);
  // SVG y grows downward; the group inside the svg flips it back to north-up.
  const viewBox = `${viewport.cx - viewport.spanX / 2} ${-viewport.cy - spanY / 2} ${viewport.spanX} ${spanY}`;

  return {
    viewport,
    viewBox,
    isPanning,
    zoomBy,
    resetView,
    centreOn,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
  };
}
