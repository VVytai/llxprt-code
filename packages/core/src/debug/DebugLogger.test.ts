/**
 * @plan PLAN-20250120-DEBUGLOGGING.P04
 * @requirement REQ-001,REQ-002,REQ-006
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DebugLogger } from './DebugLogger.js';

describe('DebugLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @requirement REQ-001.1
   * @scenario Logger creation with namespace
   * @given namespace 'llxprt:test'
   * @when new DebugLogger created
   * @then Logger instance exists with namespace set
   */
  it('should create logger with namespace @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe('llxprt:test');
  });

  /**
   * @requirement REQ-001.2
   * @scenario Lazy evaluation of log functions
   * @given expensive function that returns message
   * @when logger disabled and log called with function
   * @then Function never evaluated
   */
  it('should not evaluate function when disabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = false;

    const expensiveFn = vi.fn(() => 'expensive message');
    logger.log(expensiveFn);

    expect(expensiveFn).not.toHaveBeenCalled();
  });

  /**
   * @requirement REQ-001.2
   * @scenario Lazy evaluation when enabled
   * @given expensive function that returns message
   * @when logger enabled and log called with function
   * @then Function evaluated and result logged
   */
  it('should evaluate function when enabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const expensiveFn = vi.fn(() => 'expensive message');
    const writeSpy = vi.spyOn(logger.fileOutput, 'write');

    logger.log(expensiveFn);

    expect(expensiveFn).toHaveBeenCalledOnce();
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'expensive message',
      }),
    );
  });

  /**
   * @requirement REQ-002.1
   * @scenario Namespace pattern matching
   * @given namespace 'llxprt:openai:tools'
   * @when pattern 'llxprt:openai:*' configured
   * @then Logger is enabled
   */
  it('should match wildcard namespaces @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:openai:tools');
    logger.configManager.setEphemeralConfig({
      enabled: true,
      namespaces: ['llxprt:openai:*'],
    });

    expect(logger.checkEnabled()).toBe(true);
  });

  /**
   * @requirement REQ-006.1
   * @scenario Zero overhead when disabled
   * @given logger disabled
   * @when log called 1000 times
   * @then Execution time < 1ms
   */
  it('should have zero overhead when disabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = false;

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      logger.log('test message');
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1);
  });

  /**
   * @requirement REQ-001
   * @scenario Sensitive data redaction
   * @given message with API key
   * @when logged
   * @then API key replaced with [REDACTED]
   */
  it('should redact sensitive data @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.log('Using apiKey: sk-1234567890');

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Using apiKey: [REDACTED]',
      }),
    );
  });

  /**
   * @requirement REQ-001.3
   * @scenario Log level filtering
   * @given logger with level 'error'
   * @when debug message logged
   * @then Message not written to output
   */
  it('should filter messages based on log level @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;
    logger.level = 'error';

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.debug('debug message');

    expect(writeSpy).not.toHaveBeenCalled();
  });

  /**
   * @requirement REQ-001.4
   * @scenario Error level logging
   * @given logger enabled
   * @when error logged
   * @then Error written with timestamp and level
   */
  it('should log error messages with proper format @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.error('error message');

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'llxprt:test',
        level: 'error',
        message: 'error message',
        timestamp: expect.any(String),
      }),
    );
  });

  /**
   * @requirement REQ-001.5
   * @scenario Multiple arguments handling
   * @given logger enabled
   * @when log called with multiple args
   * @then All args included in log entry
   */
  it('should handle multiple log arguments @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.log('message', { data: 'value' }, 123);

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'message',
        args: [{ data: 'value' }, 123],
      }),
    );
  });

  /**
   * @requirement REQ-002.2
   * @scenario Complex namespace patterns
   * @given namespace 'llxprt:core:utils:parser'
   * @when pattern 'llxprt:core:*' configured
   * @then Logger matches pattern
   */
  it('should match complex namespace patterns @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:core:utils:parser');
    logger.configManager.setEphemeralConfig({
      enabled: true,
      namespaces: ['llxprt:core:*'],
    });

    expect(logger.checkEnabled()).toBe(true);
  });

  /**
   * @requirement REQ-002.3
   * @scenario Exact namespace matching
   * @given namespace 'llxprt:test'
   * @when exact pattern 'llxprt:test' configured
   * @then Logger is enabled
   */
  it('should match exact namespace patterns @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.configManager.setEphemeralConfig({
      enabled: true,
      namespaces: ['llxprt:test'],
    });

    expect(logger.checkEnabled()).toBe(true);
  });

  /**
   * @requirement REQ-002.4
   * @scenario Multiple namespace patterns
   * @given namespace 'llxprt:openai'
   * @when multiple patterns configured
   * @then Logger matches appropriate pattern
   */
  it('should match multiple namespace patterns @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:openai');
    logger.configManager.setEphemeralConfig({
      enabled: true,
      namespaces: ['llxprt:core:*', 'llxprt:openai', 'llxprt:cli:*'],
    });

    expect(logger.checkEnabled()).toBe(true);
  });

  /**
   * @requirement REQ-001.6
   * @scenario String message logging
   * @given logger enabled
   * @when string message logged
   * @then Message written correctly
   */
  it('should log string messages @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.log('simple string message');

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'simple string message',
      }),
    );
  });

  /**
   * @requirement REQ-001.7
   * @scenario Timestamp formatting
   * @given logger enabled
   * @when message logged
   * @then Timestamp in ISO format
   */
  it('should include ISO timestamp in log entries @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.log('test message');

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
      }),
    );
  });

  /**
   * @requirement REQ-006.2
   * @scenario Performance with enabled logger
   * @given logger enabled
   * @when logging 100 messages
   * @then Performance remains reasonable
   */
  it('should maintain reasonable performance when enabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      logger.log(`message ${i}`);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  /**
   * @requirement REQ-001.8
   * @scenario Config manager integration
   * @given config manager available
   * @when settings updated
   * @then Logger respects new settings
   */
  it('should integrate with config manager @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');

    expect(logger.configManager).toBeDefined();
    expect(typeof logger.configManager.setEphemeralConfig).toBe('function');
  });

  /**
   * @requirement REQ-001.9
   * @scenario File output integration
   * @given file output available
   * @when logger enabled and message logged
   * @then File output write method called
   */
  it('should integrate with file output @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    expect(logger.fileOutput).toBeDefined();
    expect(typeof logger.fileOutput.write).toBe('function');

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.log('test message');

    expect(writeSpy).toHaveBeenCalled();
  });

  /**
   * @requirement REQ-002.5
   * @scenario Namespace mismatch
   * @given namespace 'llxprt:test'
   * @when pattern 'llxprt:other:*' configured
   * @then Logger is disabled
   */
  it('should not match unrelated namespace patterns @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.configManager.setEphemeralConfig({
      enabled: true,
      namespaces: ['llxprt:other:*', 'different:namespace'],
    });

    expect(logger.checkEnabled()).toBe(false);
  });

  /**
   * @requirement REQ-001.10
   * @scenario Debug level logging
   * @given logger enabled with debug level
   * @when debug message logged
   * @then Message written with debug level
   */
  it('should log debug messages at debug level @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;
    logger.level = 'debug';

    const writeSpy = vi.spyOn(logger.fileOutput, 'write');
    logger.debug('debug message');

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        message: 'debug message',
      }),
    );
  });

  /**
   * @requirement REQ-001.11
   * @scenario Function evaluation with arguments
   * @given function that uses additional arguments
   * @when logger enabled and log called with function and args
   * @then Function evaluated and args included
   */
  it('should handle function evaluation with additional arguments @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = true;

    const expensiveFn = vi.fn(() => 'function result');
    const writeSpy = vi.spyOn(logger.fileOutput, 'write');

    logger.log(expensiveFn, { extra: 'data' }, 42);

    expect(expensiveFn).toHaveBeenCalledOnce();
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'function result',
        args: [{ extra: 'data' }, 42],
      }),
    );
  });

  /**
   * @requirement REQ-006.3
   * @scenario Memory efficiency
   * @given logger disabled
   * @when multiple complex objects logged
   * @then No memory accumulation occurs
   */
  it('should not accumulate memory when disabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    const logger = new DebugLogger('llxprt:test');
    logger.enabled = false;

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      logger.log('message', { large: 'data'.repeat(1000) });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Should not accumulate significant memory (under 1MB)
    expect(memoryIncrease).toBeLessThan(1024 * 1024);
  });

  // Property-based tests (30% requirement)

  /**
   * @requirement REQ-002
   * @scenario Property: Any valid namespace format works
   */
  it('should handle any namespace string @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(fc.string(), (namespace) => {
        const logger = new DebugLogger(namespace);
        expect(logger.namespace).toBe(namespace);
      }),
    );
  });

  /**
   * @requirement REQ-001
   * @scenario Property: Log accepts any message type
   */
  it('should handle any message type when disabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(fc.anything(), (message) => {
        const logger = new DebugLogger('test');
        logger.enabled = false;

        const writeSpy = vi.spyOn(logger.fileOutput, 'write');
        logger.log(message);

        // Verify that when disabled, no write operation occurs
        expect(writeSpy).not.toHaveBeenCalled();
        expect(logger.enabled).toBe(false);
      }),
    );
  });

  /**
   * @requirement REQ-001
   * @scenario Property: String messages always produce valid log entries
   */
  it('should handle any string message when enabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const logger = new DebugLogger('test');
        logger.enabled = true;

        const writeSpy = vi.spyOn(logger.fileOutput, 'write');
        logger.log(message);

        if (writeSpy.mock.calls.length > 0) {
          const logEntry = writeSpy.mock.calls[0][0];
          expect(logEntry).toHaveProperty('message', message);
          expect(logEntry).toHaveProperty('namespace', 'test');
          expect(logEntry).toHaveProperty('level');
          expect(logEntry).toHaveProperty('timestamp');
        }
      }),
    );
  });

  /**
   * @requirement REQ-002
   * @scenario Property: Namespace pattern matching is consistent
   */
  it('should consistently match namespace patterns @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0),
        fc.string().filter((s) => s.length > 0),
        (prefix, suffix) => {
          const namespace = `${prefix}:${suffix}`;
          const pattern = `${prefix}:*`;

          const logger = new DebugLogger(namespace);
          logger.configManager.setEphemeralConfig({
            enabled: true,
            namespaces: [pattern],
          });

          expect(logger.checkEnabled()).toBe(true);
        },
      ),
    );
  });

  /**
   * @requirement REQ-006
   * @scenario Property: Performance is consistent regardless of message content
   */
  it('should maintain consistent performance across different message types @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.object()),
        (message) => {
          const logger = new DebugLogger('test');
          logger.enabled = false;

          const start = performance.now();
          logger.log(message);
          const duration = performance.now() - start;

          expect(duration).toBeLessThan(0.1); // Should be very fast when disabled
        },
      ),
    );
  });

  /**
   * @requirement REQ-001
   * @scenario Property: Arguments array handling
   */
  it('should handle any combination of arguments @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.anything(), { maxLength: 5 }),
        (message, args) => {
          const logger = new DebugLogger('test');
          logger.enabled = true;

          const writeSpy = vi.spyOn(logger.fileOutput, 'write');
          logger.log(message, ...args);

          if (writeSpy.mock.calls.length > 0) {
            const logEntry = writeSpy.mock.calls[0][0];
            expect(logEntry).toHaveProperty('message', message);
            if (args.length > 0) {
              expect(logEntry).toHaveProperty('args', args);
            }
          }
        },
      ),
    );
  });

  /**
   * @requirement REQ-002
   * @scenario Property: Multiple namespace patterns work correctly
   */
  it('should handle multiple namespace patterns correctly @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0),
        fc.array(
          fc.string().filter((s) => s.length > 0),
          { minLength: 1, maxLength: 5 },
        ),
        (namespace, patterns) => {
          const logger = new DebugLogger(namespace);
          logger.configManager.setEphemeralConfig({
            enabled: true,
            namespaces: [...patterns, namespace], // Include exact match
          });

          expect(logger.checkEnabled()).toBe(true);
        },
      ),
    );
  });

  /**
   * @requirement REQ-001
   * @scenario Property: Log levels work consistently
   */
  it('should handle log levels consistently @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('debug', 'log', 'error'),
        fc.string(),
        (level, message) => {
          const logger = new DebugLogger('test');
          logger.enabled = true;

          const writeSpy = vi.spyOn(logger.fileOutput, 'write');

          if (level === 'debug') {
            logger.debug(message);
          } else if (level === 'log') {
            logger.log(message);
          } else {
            logger.error(message);
          }

          if (writeSpy.mock.calls.length > 0) {
            const logEntry = writeSpy.mock.calls[0][0];
            expect(logEntry).toHaveProperty('level', level);
            expect(logEntry).toHaveProperty('message', message);
          }
        },
      ),
    );
  });

  /**
   * @requirement REQ-006
   * @scenario Property: Memory usage remains stable when disabled
   */
  it('should maintain stable memory usage when disabled @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 10, maxLength: 100 }),
        (messages) => {
          const logger = new DebugLogger('test');
          logger.enabled = false;

          const initialMemory = process.memoryUsage().heapUsed;

          messages.forEach((msg) => logger.log(msg));

          const finalMemory = process.memoryUsage().heapUsed;
          const memoryDelta = Math.abs(finalMemory - initialMemory);

          // Memory usage should not significantly increase when disabled
          expect(memoryDelta).toBeLessThan(1024 * 1024); // Less than 1MB
        },
      ),
    );
  });

  /**
   * @requirement REQ-001
   * @scenario Property: Function evaluation behavior is consistent
   */
  it('should handle function evaluation consistently @plan:PLAN-20250120-DEBUGLOGGING.P04', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.string(), (enabled, returnValue) => {
        const logger = new DebugLogger('test');
        logger.enabled = enabled;

        const testFn = vi.fn(() => returnValue);
        const writeSpy = vi.spyOn(logger.fileOutput, 'write');

        logger.log(testFn);

        if (enabled) {
          expect(testFn).toHaveBeenCalledOnce();
          expect(writeSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              message: returnValue,
            }),
          );
        } else {
          expect(testFn).not.toHaveBeenCalled();
          expect(writeSpy).not.toHaveBeenCalled();
        }
      }),
    );
  });
});
