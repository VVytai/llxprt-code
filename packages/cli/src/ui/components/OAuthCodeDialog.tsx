/**
 * OAuth Code Input Dialog Component
 *
 * Allows users to paste authorization code from browser
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress, Key } from '../hooks/useKeypress.js';

interface OAuthCodeDialogProps {
  provider: string;
  onClose: () => void;
  onSubmit: (code: string) => void;
}

export const OAuthCodeDialog: React.FC<OAuthCodeDialogProps> = ({
  provider,
  onClose,
  onSubmit,
}) => {
  const [code, setCode] = useState('');

  const handleInput = useCallback(
    (key: Key) => {
      // Handle escape to close
      if (key.name === 'escape') {
        onClose();
        return;
      }

      // Handle enter to submit
      if (key.name === 'return') {
        if (code.trim()) {
          onSubmit(code.trim());
          onClose();
        }
        return;
      }

      // Handle clear (allow clearing the field with Cmd+K or Ctrl+L)
      if ((key.ctrl && key.name === 'l') || (key.meta && key.name === 'k')) {
        setCode('');
        return;
      }

      // ONLY accept pasted input - ignore ALL typed characters
      if (key.paste && key.sequence) {
        // The sequence already has the paste content without escape codes
        // Just filter to only allow valid OAuth code characters
        const cleanInput = key.sequence.replace(/[^a-zA-Z0-9\-_#]/g, '');
        if (cleanInput) {
          // Replace the entire code with the pasted content (don't append)
          setCode(cleanInput);
        }
        return;
      }

      // Explicitly ignore ALL other input including:
      // - Regular typed characters
      // - Control codes
      // - Backspace (users must paste the entire correct code)
      // This prevents accidental control codes like I, IO, etc. from being added
    },
    [code, onClose, onSubmit],
  );

  useKeypress(handleInput, { isActive: true });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={Colors.AccentCyan}
      paddingX={2}
      paddingY={1}
      marginX={2}
      marginY={1}
    >
      <Text bold color={Colors.AccentCyan}>
        {provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth
        Authentication
      </Text>
      <Text color={Colors.Foreground}>
        Please check your browser and authorize the application.
      </Text>
      <Text color={Colors.Foreground}>
        After authorizing, paste the authorization code below:
      </Text>
      <Box marginTop={1}>
        <Text color={Colors.AccentCyan}>Code: </Text>
        <Text color={Colors.Foreground}>
          {code || '(paste only - typing disabled)'}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Paste code • Enter to submit • Escape to cancel • Ctrl+L to clear
        </Text>
      </Box>
    </Box>
  );
};
