/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFolderTrust } from './useFolderTrust.js';
import { LoadedSettings } from '../../config/settings.js';
import { FolderTrustChoice } from '../components/FolderTrustDialog.js';
import {
  LoadedTrustedFolders,
  TrustLevel,
} from '../../config/trustedFolders.js';
import * as process from 'process';
import { Config } from '@vybestack/llxprt-code-core';

import * as trustedFolders from '../../config/trustedFolders.js';

vi.mock('process', () => ({
  cwd: vi.fn(),
  platform: 'linux',
}));

describe('useFolderTrust', () => {
  let mockSettings: LoadedSettings;
  let mockConfig: Config;
  let mockTrustedFolders: LoadedTrustedFolders;
  let loadTrustedFoldersSpy: vi.SpyInstance;
  let isWorkspaceTrustedSpy: vi.SpyInstance;

  beforeEach(() => {
    mockSettings = {
      merged: {
        folderTrustFeature: true,
        folderTrust: undefined,
      },
      setValue: vi.fn(),
    } as unknown as LoadedSettings;

    mockConfig = {
      isTrustedFolder: vi.fn(),
    } as unknown as Config;

    mockTrustedFolders = {
      setValue: vi.fn(),
    } as unknown as LoadedTrustedFolders;

    loadTrustedFoldersSpy = vi
      .spyOn(trustedFolders, 'loadTrustedFolders')
      .mockReturnValue(mockTrustedFolders);
    isWorkspaceTrustedSpy = vi.spyOn(trustedFolders, 'isWorkspaceTrusted');
    (process.cwd as vi.Mock).mockReturnValue('/test/path');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not open dialog when folder is already trusted', () => {
    isWorkspaceTrustedSpy.mockReturnValue(true);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(true);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );
    expect(result.current.isFolderTrustDialogOpen).toBe(false);
  });

  it('should not open dialog when folder is already untrusted', () => {
    isWorkspaceTrustedSpy.mockReturnValue(false);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(false);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );
    expect(result.current.isFolderTrustDialogOpen).toBe(false);
  });

  it('should open dialog when folder trust is undefined', () => {
    isWorkspaceTrustedSpy.mockReturnValue(undefined);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );
    expect(result.current.isFolderTrustDialogOpen).toBe(true);
  });

  it('should handle TRUST_FOLDER choice', () => {
    isWorkspaceTrustedSpy
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(true);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    isWorkspaceTrustedSpy.mockReturnValue(true);
    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.TRUST_FOLDER);
    });

    expect(loadTrustedFoldersSpy).toHaveBeenCalled();
    expect(mockTrustedFolders.setValue).toHaveBeenCalledWith(
      '/test/path',
      TrustLevel.TRUST_FOLDER,
    );
    expect(result.current.isFolderTrustDialogOpen).toBe(false);
    // Config trust state is managed by trustedFolders, not directly on config
  });

  it('should handle TRUST_PARENT choice', () => {
    isWorkspaceTrustedSpy
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(true);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.TRUST_PARENT);
    });

    expect(mockTrustedFolders.setValue).toHaveBeenCalledWith(
      '/test/path',
      TrustLevel.TRUST_PARENT,
    );
    expect(result.current.isFolderTrustDialogOpen).toBe(false);
    // Config trust state is managed by trustedFolders, not directly on config
  });

  it('should handle DO_NOT_TRUST choice and trigger restart', () => {
    isWorkspaceTrustedSpy
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(false);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.DO_NOT_TRUST);
    });

    expect(mockTrustedFolders.setValue).toHaveBeenCalledWith(
      '/test/path',
      TrustLevel.DO_NOT_TRUST,
    );
    // Config trust state is managed by trustedFolders, not directly on config
    expect(result.current.isRestarting).toBe(true);
    expect(result.current.isFolderTrustDialogOpen).toBe(true);
  });

  it('should do nothing for default choice', () => {
    isWorkspaceTrustedSpy.mockReturnValue(undefined);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    act(() => {
      result.current.handleFolderTrustSelect(
        'invalid_choice' as FolderTrustChoice,
      );
    });

    expect(mockTrustedFolders.setValue).not.toHaveBeenCalled();
    expect(mockSettings.setValue).not.toHaveBeenCalled();
    expect(result.current.isFolderTrustDialogOpen).toBe(true);
  });

  it('should set isRestarting to true when trust status changes from false to true', () => {
    isWorkspaceTrustedSpy.mockReturnValueOnce(false).mockReturnValueOnce(true); // Initially untrusted, then trusted
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(false);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.TRUST_FOLDER);
    });

    expect(result.current.isRestarting).toBe(true);
    expect(result.current.isFolderTrustDialogOpen).toBe(true);
  });

  it('should set isRestarting to true when trust status changes from true to false', () => {
    isWorkspaceTrustedSpy.mockReturnValueOnce(true).mockReturnValueOnce(false); // Initially trusted, then untrusted
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(true);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.DO_NOT_TRUST);
    });

    expect(result.current.isRestarting).toBe(true);
    expect(result.current.isFolderTrustDialogOpen).toBe(true);
  });

  it('should not set isRestarting when trust status remains the same', () => {
    isWorkspaceTrustedSpy.mockReturnValue(true);
    (mockConfig.isTrustedFolder as vi.Mock).mockReturnValue(true);
    const { result } = renderHook(() =>
      useFolderTrust(mockSettings, mockConfig),
    );

    // No need to reset mock since setIsTrustedFolder is no longer called

    act(() => {
      result.current.handleFolderTrustSelect(FolderTrustChoice.TRUST_FOLDER);
    });

    expect(result.current.isRestarting).toBe(false);
    expect(result.current.isFolderTrustDialogOpen).toBe(false);
  });
});
