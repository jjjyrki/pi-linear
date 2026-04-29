import { createNotImplementedError } from './errors.js';

export function createLinearClient(): never {
  throw createNotImplementedError('Linear client setup');
}
