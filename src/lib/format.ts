/** Display formatting. Units are always shown; a bare number on a GCS is a bug. */

import type { AlertSeverity } from '../types/alerts';
import type { VehicleKind, VehicleStatus } from '../types/telemetry';

export function metres(value: number, digits = 1): string {
  return `${value.toFixed(digits)} m`;
}

export function speed(value: number, digits = 1): string {
  return `${value.toFixed(digits)} m/s`;
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)} %`;
}

export function volts(value: number): string {
  return `${value.toFixed(2)} V`;
}

export function amps(value: number): string {
  return `${value.toFixed(1)} A`;
}

export function dbm(value: number): string {
  return `${value.toFixed(0)} dBm`;
}

export function degrees(value: number): string {
  return `${value.toFixed(0)}°`;
}

/** mm:ss for simulated elapsed time. */
export function clockFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function wallClock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const KIND_LABELS: Record<VehicleKind, string> = {
  quadrotor: 'Quadrotor',
  vtol: 'VTOL',
  ground: 'Ground robot',
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  nominal: 'Nominal',
  warning: 'Warning',
  critical: 'Critical',
  offline: 'Offline',
};

export const STATUS_TOKENS: Record<VehicleStatus, string> = {
  nominal: 'var(--status-nominal)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
  offline: 'var(--status-offline)',
};

export const SEVERITY_TOKENS: Record<AlertSeverity, string> = {
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
};
