/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import { Footer } from './Footer.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

vi.mock('../hooks/useTerminalSize.js');
vi.mock('../../providers/providerManagerInstance.js', () => ({
  getProviderManager: () => ({
    getActiveProvider: () => ({ name: 'openai' }),
  }),
}));

describe('Footer Responsive Behavior', () => {
  let mockUseTerminalSize: MockedFunction<typeof useTerminalSize>;

  const defaultProps = {
    model: 'gpt-4',
    targetDir: '/home/user/projects/long-project-name-for-testing',
    branchName: 'feature/very-long-branch-name-that-needs-truncation',
    debugMode: false,
    debugMessage: '',
    errorCount: 0,
    showErrorDetails: false,
    showMemoryUsage: true,
    promptTokenCount: 8234,
    isPaidMode: false,
    nightly: false,
    vimMode: 'NORMAL',
    contextLimit: 100000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTerminalSize = useTerminalSize as MockedFunction<
      typeof useTerminalSize
    >;
  });

  describe('NARROW width behavior (< 80 cols)', () => {
    beforeEach(() => {
      mockUseTerminalSize.mockReturnValue({ columns: 60, rows: 20 });
    });

    it('should show abbreviated memory indicator', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show abbreviated memory format
      expect(output).toMatch(/Mem:/);
      // Should NOT show full "Memory:" text
      expect(output).not.toMatch(/Memory:/);
    });

    it('should show abbreviated context indicator', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show abbreviated context format
      expect(output).toMatch(/Ctx:/);
      // Should NOT show full "Context:" text
      expect(output).not.toMatch(/Context:/);
    });

    it('should NOT show model name at narrow width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should NOT show model name
      expect(output).not.toContain('gpt-4');
      expect(output).not.toMatch(/Model:/);
    });

    it('should NOT show timestamp at narrow width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should NOT show timestamp
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should truncate long branch names', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show truncated branch name
      expect(output).toMatch(/\.\.\./);
      // Should NOT show full branch name
      expect(output).not.toContain(
        'feature/very-long-branch-name-that-needs-truncation',
      );
    });
  });

  describe('STANDARD width behavior (80-120 cols)', () => {
    beforeEach(() => {
      mockUseTerminalSize.mockReturnValue({ columns: 100, rows: 20 });
    });

    it('should show full memory indicator label', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show full "Memory:" label
      expect(output).toMatch(/Memory:/);
      // Should NOT show percentage details in parens
      expect(output).not.toMatch(/Memory: \d+% \(\d+\.\d+GB\/\d+\.\d+GB\)/);
    });

    it('should show full context indicator label', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show full "Context:" label
      expect(output).toMatch(/Context:/);
      // Should NOT show fully expanded token counts
      expect(output).not.toMatch(/Context: \d+,\d+\/\d+,\d+ tokens/);
    });

    it('should show model name at standard width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show model name
      expect(output).toContain('gpt-4');
      // Model name shows without 'Model:' prefix now
    });

    it('should NOT show timestamp at standard width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should NOT show timestamp
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('WIDE width behavior (> 120 cols)', () => {
    beforeEach(() => {
      mockUseTerminalSize.mockReturnValue({ columns: 180, rows: 20 });
    });

    it('should show detailed memory usage with parenthetical details', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show detailed memory format (may wrap across lines in two-line layout)
      expect(output).toMatch(/Memory: \d+%/);
      expect(output).toMatch(/\(\d+\.\d+GB\/\d+\.\d+GB\)/);
    });

    it('should show detailed context usage with comma-separated numbers', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show detailed context format (shows as 8,234/100,000 tokens)
      expect(output).toMatch(/Context: \d+,\d+\/\d+,\d+/);
    });

    it('should show model name at wide width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show model name
      expect(output).toContain('gpt-4');
      // Model name shows without 'Model:' prefix now
    });

    it('should show timestamp at wide width', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show timestamp in HH:MM:SS format (may wrap across lines)
      expect(output).toMatch(/\d{1,2}:\d{2}:\d/);
    });

    it('should show full branch name when space allows', () => {
      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should show branch name at wide width (wrapped as "that-need" + "-truncation*")
      expect(output).toMatch(/-truncation\*/);
    });
  });

  describe('Breakpoint edge cases', () => {
    it('should handle exact breakpoint boundaries correctly', () => {
      // Test exactly at NARROW threshold (80 cols) - should be STANDARD
      mockUseTerminalSize.mockReturnValue({ columns: 80, rows: 20 });

      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // At exactly 80, should be STANDARD behavior
      expect(output).toMatch(/Memory:/); // Not abbreviated
      expect(output).toContain('gpt-4'); // Model shown
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/); // No timestamp
    });

    it('should transition properly at STANDARD threshold', () => {
      // Test exactly at STANDARD threshold (120 cols) - should be STANDARD
      mockUseTerminalSize.mockReturnValue({ columns: 120, rows: 20 });

      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // At exactly 120, should be STANDARD behavior (not WIDE)
      expect(output).toMatch(/Memory:/);
      expect(output).toContain('gpt-4');
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/); // Still no timestamp
    });
  });

  describe('Information priority preservation', () => {
    it('should always show memory and context info at all widths', () => {
      const widths = [60, 100, 180];

      widths.forEach((width) => {
        mockUseTerminalSize.mockReturnValue({ columns: width, rows: 20 });
        const { lastFrame } = render(<Footer {...defaultProps} />);
        const output = lastFrame();

        // Memory and context should always be visible
        expect(output).toMatch(/(Mem:|Memory:)/);
        expect(output).toMatch(/(Ctx:|Context:)/);
      });
    });

    it('should show branch name at all widths (possibly truncated)', () => {
      const widths = [60, 100, 180];

      widths.forEach((width) => {
        mockUseTerminalSize.mockReturnValue({ columns: width, rows: 20 });
        const { lastFrame } = render(<Footer {...defaultProps} />);
        const output = lastFrame();

        // Branch should always be visible (even if truncated)
        expect(output).toMatch(/(feature|\.\.\.)/);
      });
    });
  });

  describe('Two-line layout requirement', () => {
    it('should organize content into logical 2-line structure', () => {
      const widths = [60, 100, 180];

      widths.forEach((width) => {
        mockUseTerminalSize.mockReturnValue({ columns: width, rows: 20 });
        const { lastFrame } = render(<Footer {...defaultProps} />);
        const output = lastFrame();

        // Should have status info (Memory|Context) separate from path info
        expect(output).toMatch(/(Mem:|Memory:)/);
        expect(output).toMatch(/(Ctx:|Context:)/);
        expect(output).toMatch(/(long-project-name|\/home\/user\/projects)/); // Path (may be truncated)
        if (width >= 80) {
          expect(output).toMatch(/gpt-4/); // Model only shown at standard+ widths
        }
      });
    });

    it('should show Memory|Context|Time together when wide', () => {
      mockUseTerminalSize.mockReturnValue({ columns: 180, rows: 20 });

      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should have Memory, Context, and Time displayed
      expect(output).toMatch(/Memory:/);
      expect(output).toMatch(/Context:/);
      expect(output).toMatch(/\d{1,2}:\d{2}:\d/); // Timestamp (may wrap)

      // Should also have path and model displayed
      expect(output).toContain('/home/user/projects');
      expect(output).toContain('gpt-4');
    });

    it('should organize Path and Model information appropriately', () => {
      mockUseTerminalSize.mockReturnValue({ columns: 180, rows: 20 });

      const { lastFrame } = render(<Footer {...defaultProps} />);
      const output = lastFrame();

      // Should contain path and model information
      expect(output).toContain('/home/user/projects');
      expect(output).toContain('gpt-4');
      expect(output).toContain('feature/'); // Branch name

      // Should also have memory and context (they can be on separate logical lines)
      expect(output).toMatch(/Memory:/);
      expect(output).toMatch(/Context:/);
    });

    it('should adapt content appropriately across width breakpoints', () => {
      // Test narrow width
      mockUseTerminalSize.mockReturnValue({ columns: 60, rows: 20 });
      let { lastFrame } = render(<Footer {...defaultProps} />);
      let output = lastFrame();

      expect(output).toMatch(/Mem:/); // Abbreviated
      expect(output).toMatch(/Ctx:/); // Abbreviated
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/); // No timestamp at narrow

      // Test standard width
      mockUseTerminalSize.mockReturnValue({ columns: 100, rows: 20 });
      ({ lastFrame } = render(<Footer {...defaultProps} />));
      output = lastFrame();

      expect(output).toMatch(/Memory:/); // Full label
      expect(output).toMatch(/Context:/); // Full label
      expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/); // Still no timestamp at standard

      // Test wide width
      mockUseTerminalSize.mockReturnValue({ columns: 180, rows: 20 });
      ({ lastFrame } = render(<Footer {...defaultProps} />));
      output = lastFrame();

      expect(output).toMatch(/Memory:/); // Full label
      expect(output).toMatch(/Context:/); // Full label
      expect(output).toMatch(/\d{1,2}:\d{2}:\d/); // Timestamp at wide (may wrap)
    });
  });
});
