/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { Tool } from '@vybestack/llxprt-code-core';
import { Colors } from '../colors.js';

interface ToolsDialogProps {
  tools: Tool[];
  action: 'enable' | 'disable';
  disabledTools: string[];
  onSelect: (toolName: string) => void;
  onClose: () => void;
}

export const ToolsDialog: React.FC<ToolsDialogProps> = ({
  tools,
  action,
  disabledTools,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter tools based on action
  const availableTools = tools.filter((tool) => {
    if (action === 'disable') {
      return !disabledTools.includes(tool.name);
    } else {
      return disabledTools.includes(tool.name);
    }
  });

  // Create items for RadioButtonSelect
  const items = availableTools.map((tool) => ({
    label: tool.displayName,
    value: tool.name,
  }));

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect],
  );

  const handleHighlight = useCallback(
    (value: string) => {
      const index = items.findIndex((item) => item.value === value);
      if (index >= 0) {
        setSelectedIndex(index);
      }
    },
    [items],
  );

  useInput((_, key) => {
    if (key.escape) {
      onClose();
    }
  });

  if (availableTools.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color={Colors.AccentYellow}>
          {action === 'disable'
            ? 'All tools are already disabled.'
            : 'No tools are currently disabled.'}
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to return</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={Colors.AccentBlue}>
          Select a tool to {action}:
        </Text>
      </Box>

      <RadioButtonSelect
        items={items}
        onSelect={handleSelect}
        onHighlight={handleHighlight}
        isFocused={true}
        initialIndex={selectedIndex}
      />

      {availableTools[selectedIndex] && (
        <Box marginTop={1}>
          <Text dimColor>Tool name: {availableTools[selectedIndex].name}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press ENTER to {action} • ESC to cancel</Text>
      </Box>
    </Box>
  );
};
