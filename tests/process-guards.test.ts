import { jest } from '@jest/globals';
import { RatelimitedLinearError } from '@linear/sdk';

import {
  handleUncaughtException,
  handleUnhandledRejection,
  installLinearProcessGuards,
  isRecoverableLinearProcessError,
} from '../src/linear/processGuards.js';

describe('linear process guards', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('recognizes recoverable Linear SDK failures', () => {
    const error = new RatelimitedLinearError({ response: { headers: new Map([['retry-after', '3600']]) } } as never, []);
    expect(isRecoverableLinearProcessError(error)).toBe(true);
    expect(isRecoverableLinearProcessError(new Error('boom'))).toBe(false);
  });

  it('logs and suppresses recoverable unhandled rejections', () => {
    const error = new RatelimitedLinearError({ response: { headers: new Map([['retry-after', '3600']]) } } as never, []);

    handleUnhandledRejection(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('pi-linear recovered unhandledRejection:'));

    handleUncaughtException(error);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Linear uncaught exceptions', () => {
    handleUncaughtException(new Error('boom'));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('installs process listeners only once', () => {
    installLinearProcessGuards();
    const unhandledCount = process.listeners('unhandledRejection').length;
    const uncaughtCount = process.listeners('uncaughtException').length;

    installLinearProcessGuards();

    expect(process.listeners('unhandledRejection').length).toBe(unhandledCount);
    expect(process.listeners('uncaughtException').length).toBe(uncaughtCount);
  });
});
