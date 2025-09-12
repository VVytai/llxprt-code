/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { type Config, type Settings } from '@vybestack/llxprt-code-core';
import { LoadedSettings } from '../../config/settings.js';
import { FolderTrustChoice } from '../components/FolderTrustDialog.js';
import {
  loadTrustedFolders,
  TrustLevel,
  isWorkspaceTrusted,
} from '../../config/trustedFolders.js';
import * as process from 'process';

export const useFolderTrust = (settings: LoadedSettings, config: Config) => {
  const [isTrusted, setIsTrusted] = useState<boolean | undefined>(
    config.isTrustedFolder(),
  );
  const [isFolderTrustDialogOpen, setIsFolderTrustDialogOpen] = useState(
    config.isTrustedFolder() === undefined,
  );
  const [isRestarting, setIsRestarting] = useState(false);

  const { folderTrust, folderTrustFeature } = settings.merged;
  useEffect(() => {
    const trusted = isWorkspaceTrusted({
      security: {
        folderTrust: {
          featureEnabled: folderTrustFeature,
          enabled: folderTrust,
        },
      },
    } as Settings);
    setIsTrusted(trusted);
    if (trusted === undefined) {
      setIsFolderTrustDialogOpen(true);
    }
  }, [folderTrust, folderTrustFeature]);

  const handleFolderTrustSelect = useCallback(
    (choice: FolderTrustChoice) => {
      const trustedFolders = loadTrustedFolders();
      const cwd = process.cwd();
      let trustLevel: TrustLevel;

      const wasTrusted = isTrusted ?? true;

      switch (choice) {
        case FolderTrustChoice.TRUST_FOLDER:
          trustLevel = TrustLevel.TRUST_FOLDER;
          break;
        case FolderTrustChoice.TRUST_PARENT:
          trustLevel = TrustLevel.TRUST_PARENT;
          break;
        case FolderTrustChoice.DO_NOT_TRUST:
          trustLevel = TrustLevel.DO_NOT_TRUST;
          break;
        default:
          return;
      }

      trustedFolders.setValue(cwd, trustLevel);
      const newIsTrusted =
        trustLevel === TrustLevel.TRUST_FOLDER ||
        trustLevel === TrustLevel.TRUST_PARENT;
      setIsTrusted(newIsTrusted);

      // Trust state is managed by trustedFolders and doesn't need to be set on config

      const needsRestart = wasTrusted !== newIsTrusted;
      if (needsRestart) {
        setIsRestarting(true);
        setIsFolderTrustDialogOpen(true);
      } else {
        setIsFolderTrustDialogOpen(false);
      }
    },
    [isTrusted],
  );

  return {
    isFolderTrustDialogOpen,
    handleFolderTrustSelect,
    isRestarting,
  };
};
