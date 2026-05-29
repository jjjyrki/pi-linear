import {
  LinearAuthenticationError,
  LinearConfigurationError,
  LinearNetworkError,
  LinearNotFoundError,
  LinearPermissionError,
  LinearRateLimitError,
  LinearValidationError,
} from '../errors.js';
import { formatSafeErrorMessage, normalizeLinearApiError } from './errorHandling.js';

const HANDLER_FLAG = Symbol.for('pi-linear.processGuardsInstalled');
const HANDLED_FLAG = Symbol.for('pi-linear.processGuardHandled');

export function installLinearProcessGuards(): void {
  const state = process as typeof process & { [HANDLER_FLAG]?: boolean };
  if (state[HANDLER_FLAG]) {
    return;
  }

  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
  state[HANDLER_FLAG] = true;
}

export function isRecoverableLinearProcessError(error: unknown): boolean {
  try {
    const normalized = normalizeLinearApiError(error);
    return (
      normalized instanceof LinearConfigurationError
      || normalized instanceof LinearValidationError
      || normalized instanceof LinearNotFoundError
      || normalized instanceof LinearAuthenticationError
      || normalized instanceof LinearPermissionError
      || normalized instanceof LinearRateLimitError
      || normalized instanceof LinearNetworkError
    );
  } catch {
    return false;
  }
}

export function handleUnhandledRejection(reason: unknown): void {
  if (!isRecoverableLinearProcessError(reason)) {
    return;
  }

  markHandled(reason);
  console.error(`pi-linear recovered unhandledRejection: ${formatSafeErrorMessage(reason)}`);
}

export function handleUncaughtException(error: Error): void {
  if (wasHandled(error) || !isRecoverableLinearProcessError(error)) {
    return;
  }

  markHandled(error);
  console.error(`pi-linear recovered uncaughtException: ${formatSafeErrorMessage(error)}`);
}

function markHandled(value: unknown): void {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    Object.defineProperty(value, HANDLED_FLAG, {
      value: true,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
}

function wasHandled(value: unknown): boolean {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }
  return Boolean((value as { [HANDLED_FLAG]?: boolean })[HANDLED_FLAG]);
}
