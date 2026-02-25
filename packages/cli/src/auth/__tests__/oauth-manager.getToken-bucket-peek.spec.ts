/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthManager, OAuthProvider } from '../oauth-manager.js';
import { TokenStore, OAuthToken } from '../types.js';

/**
 * Issue 1616: getToken Bucket Peek Loop Tests (RED phase TDD)
 *
 * These tests assert the EXPECTED behavior after the fix:
 * 1. getToken() does NOT call tryFailover() during token discovery
 * 2. getToken() peeks other profile buckets via raw tokenStore reads
 * 3. getToken() switches session bucket if another bucket has a valid token
 * 4. getToken() falls through to authenticateMultipleBuckets if no valid token
 *
 * Against CURRENT code, tests 2/3/5 should FAIL because the current code
 * calls tryFailover() instead of peeking buckets.
 */

function createMockTokenStore(): TokenStore {
  return {
    saveToken: vi.fn(async (): Promise<void> => {}),
    getToken: vi.fn(async (): Promise<OAuthToken | null> => null),
    removeToken: vi.fn(async (): Promise<void> => {}),
    listProviders: vi.fn(async (): Promise<string[]> => []),
    listBuckets: vi.fn(async (): Promise<string[]> => []),
    getBucketStats: vi.fn(
      async (
        _provider: string,
        bucket: string,
      ): Promise<{
        bucket: string;
        requestCount: number;
        percentage: number;
        lastUsed?: number;
      } | null> => ({
        bucket,
        requestCount: 0,
        percentage: 0,
        lastUsed: undefined,
      }),
    ),
    acquireRefreshLock: vi.fn(async (): Promise<boolean> => true),
    releaseRefreshLock: vi.fn(async (): Promise<void> => {}),
  };
}

function createMockProvider(name: string): OAuthProvider {
  return {
    name,
    initiateAuth: vi.fn(async (): Promise<void> => {}),
    getToken: vi.fn(
      async (): Promise<OAuthToken> => ({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expiry: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'Bearer' as const,
      }),
    ),
    refreshToken: vi.fn(async (): Promise<OAuthToken | null> => null),
  };
}

const mockEphemeralSettings = new Map<string, unknown>();

function clearMockEphemeralSettings(): void {
  mockEphemeralSettings.clear();
}

const mockProfiles = new Map<
  string,
  {
    provider?: string;
    auth?: {
      type: string;
      buckets?: string[];
    };
  }
>();

function setMockProfile(
  name: string,
  profile: {
    provider?: string;
    auth?: {
      type: string;
      buckets?: string[];
    };
  },
): void {
  mockProfiles.set(name, profile);
}

function clearMockProfiles(): void {
  mockProfiles.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockConfig(handler?: Record<string, unknown>): any {
  return {
    getBucketFailoverHandler: () => handler,
    setBucketFailoverHandler: vi.fn(),
    getEphemeralSetting: () => undefined,
  };
}

let mockCurrentProfileName: string | null = null;

vi.mock('../../runtime/runtimeSettings.js', () => ({
  getEphemeralSetting: (key: string) => mockEphemeralSettings.get(key),
  getCliRuntimeServices: () => ({
    settingsService: {
      getCurrentProfileName: () => mockCurrentProfileName,
      get: (key: string) =>
        key === 'currentProfile' ? mockCurrentProfileName : null,
    },
  }),
  getCliProviderManager: () => ({
    getProviderByName: () => null,
  }),
  getCliRuntimeContext: () => ({
    runtimeId: 'test-runtime',
  }),
}));

vi.mock('../../config/profileManager.js', async () => {
  const actual = await vi.importActual('../../config/profileManager.js');
  return {
    ...actual,
    createProfileManager: vi.fn(async () => ({
      loadProfile: vi.fn(async (name: string) => {
        const profile = mockProfiles.get(name);
        if (!profile) {
          throw new Error(`Profile ${name} not found`);
        }
        return profile;
      }),
    })),
  };
});

describe('Issue 1616: getToken bucket peek loop', () => {
  let tokenStore: TokenStore;
  let manager: OAuthManager;
  let mockProvider: OAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    clearMockEphemeralSettings();
    clearMockProfiles();
    mockCurrentProfileName = null;
    tokenStore = createMockTokenStore();
    manager = new OAuthManager(tokenStore);
    mockProvider = createMockProvider('anthropic');
    manager.registerProvider(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return token from session bucket when it has a valid token', async () => {
    await manager.toggleOAuthEnabled('anthropic');

    const validToken: OAuthToken = {
      access_token: 'default-bucket-token',
      refresh_token: 'default-refresh',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as const,
    };

    vi.mocked(tokenStore.getToken).mockImplementation(
      async (provider: string, bucket?: string) => {
        if (provider === 'anthropic' && (bucket ?? 'default') === 'default') {
          return validToken;
        }
        return null;
      },
    );

    const result = await manager.getToken('anthropic');

    expect(result).toBe('default-bucket-token');
  });

  it('should peek other buckets when session bucket has no token and return valid token', async () => {
    await manager.toggleOAuthEnabled('anthropic');

    mockCurrentProfileName = 'opusthinkingbucketed';
    setMockProfile('opusthinkingbucketed', {
      provider: 'anthropic',
      auth: {
        type: 'oauth',
        buckets: ['default', 'claudius', 'vybestack'],
      },
    });

    const claudiusToken: OAuthToken = {
      access_token: 'claudius-bucket-token',
      refresh_token: 'claudius-refresh',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as const,
    };

    vi.mocked(tokenStore.getToken).mockImplementation(
      async (provider: string, bucket?: string) => {
        if (provider === 'anthropic' && bucket === 'claudius') {
          return claudiusToken;
        }
        return null;
      },
    );

    // Mock handler that returns false from tryFailover (current code calls it, fix won't)
    const tryFailoverSpy = vi.fn().mockResolvedValue(false);
    const mockFailoverHandler = {
      tryFailover: tryFailoverSpy,
      isEnabled: () => true,
      getBuckets: () => ['default', 'claudius', 'vybestack'],
      getCurrentBucket: () => 'default',
      resetSession: vi.fn(),
      reset: vi.fn(),
      getLastFailoverReasons: vi.fn().mockReturnValue({}),
    };

    manager.setConfigGetter(() => createMockConfig(mockFailoverHandler));

    // Expected: getToken peeks claudius in the keystore, finds valid token, returns it
    // Current code: calls tryFailover(false), falls through to authenticateMultipleBuckets,
    // which needs browser auth → won't return 'claudius-bucket-token'
    const result = await manager.getToken('anthropic');

    expect(result).toBe('claudius-bucket-token');
  });

  it('should not call tryFailover during token discovery', async () => {
    await manager.toggleOAuthEnabled('anthropic');

    mockCurrentProfileName = 'opusthinkingbucketed';
    setMockProfile('opusthinkingbucketed', {
      provider: 'anthropic',
      auth: {
        type: 'oauth',
        buckets: ['default', 'claudius', 'vybestack'],
      },
    });

    const claudiusToken: OAuthToken = {
      access_token: 'claudius-token',
      refresh_token: 'claudius-refresh',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as const,
    };

    vi.mocked(tokenStore.getToken).mockImplementation(
      async (provider: string, bucket?: string) => {
        if (provider === 'anthropic' && bucket === 'claudius') {
          return claudiusToken;
        }
        return null;
      },
    );

    const tryFailoverSpy = vi.fn().mockResolvedValue(false);
    const mockFailoverHandler = {
      tryFailover: tryFailoverSpy,
      isEnabled: () => true,
      getBuckets: () => ['default', 'claudius', 'vybestack'],
      getCurrentBucket: () => 'default',
      resetSession: vi.fn(),
      reset: vi.fn(),
      getLastFailoverReasons: vi.fn().mockReturnValue({}),
    };

    manager.setConfigGetter(() => createMockConfig(mockFailoverHandler));

    await manager.getToken('anthropic');

    // Expected: tryFailover was NEVER called — getToken uses peek loop instead
    // Current code: tryFailover IS called at line 697 → this assertion fails
    expect(tryFailoverSpy).not.toHaveBeenCalled();
  });

  it('should skip expired tokens in peek loop and use valid one', async () => {
    await manager.toggleOAuthEnabled('anthropic');

    mockCurrentProfileName = 'opusthinkingbucketed';
    setMockProfile('opusthinkingbucketed', {
      provider: 'anthropic',
      auth: {
        type: 'oauth',
        buckets: ['default', 'claudius', 'vybestack'],
      },
    });

    const expiredToken: OAuthToken = {
      access_token: 'expired-token',
      refresh_token: 'expired-refresh',
      expiry: Math.floor(Date.now() / 1000) - 3600,
      token_type: 'Bearer' as const,
    };

    const validToken: OAuthToken = {
      access_token: 'vybestack-token',
      refresh_token: 'vybestack-refresh',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as const,
    };

    vi.mocked(tokenStore.getToken).mockImplementation(
      async (provider: string, bucket?: string) => {
        if (provider === 'anthropic') {
          if (bucket === 'claudius') return expiredToken;
          if (bucket === 'vybestack') return validToken;
        }
        return null;
      },
    );

    const tryFailoverSpy = vi.fn().mockResolvedValue(false);
    const mockFailoverHandler = {
      tryFailover: tryFailoverSpy,
      isEnabled: () => true,
      getBuckets: () => ['default', 'claudius', 'vybestack'],
      getCurrentBucket: () => 'default',
      resetSession: vi.fn(),
      reset: vi.fn(),
      getLastFailoverReasons: vi.fn().mockReturnValue({}),
    };

    manager.setConfigGetter(() => createMockConfig(mockFailoverHandler));

    // Expected: peek loop skips expired claudius, finds valid vybestack, returns it
    // Current code: calls tryFailover, doesn't peek → won't return 'vybestack-token'
    const result = await manager.getToken('anthropic');

    expect(result).toBe('vybestack-token');
  });

  it('should switch session bucket when peeking finds a valid token in another bucket', async () => {
    await manager.toggleOAuthEnabled('anthropic');

    mockCurrentProfileName = 'opusthinkingbucketed';
    setMockProfile('opusthinkingbucketed', {
      provider: 'anthropic',
      auth: {
        type: 'oauth',
        buckets: ['default', 'claudius', 'vybestack'],
      },
    });

    const claudiusToken: OAuthToken = {
      access_token: 'claudius-bucket-token',
      refresh_token: 'claudius-refresh',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as const,
    };

    vi.mocked(tokenStore.getToken).mockImplementation(
      async (provider: string, bucket?: string) => {
        if (provider === 'anthropic' && bucket === 'claudius') {
          return claudiusToken;
        }
        return null;
      },
    );

    const tryFailoverSpy = vi.fn().mockResolvedValue(false);
    const mockFailoverHandler = {
      tryFailover: tryFailoverSpy,
      isEnabled: () => true,
      getBuckets: () => ['default', 'claudius', 'vybestack'],
      getCurrentBucket: () => 'default',
      resetSession: vi.fn(),
      reset: vi.fn(),
      getLastFailoverReasons: vi.fn().mockReturnValue({}),
    };

    manager.setConfigGetter(() => createMockConfig(mockFailoverHandler));

    // Spy on setSessionBucket
    const setSessionBucketSpy = vi.spyOn(manager, 'setSessionBucket');

    await manager.getToken('anthropic');

    // Expected: peek loop found claudius token → switched session bucket to claudius
    // Current code: doesn't peek → doesn't switch → this fails
    expect(setSessionBucketSpy).toHaveBeenCalledWith('anthropic', 'claudius');
  });
});
