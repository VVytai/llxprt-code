/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

/**
 * Hook name validation schema.
 *
 * Hook names must:
 * - Be 1-128 characters long
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Not be a reserved JavaScript object key
 */
const HOOK_NAME_SCHEMA = z
  .string()
  .min(1, 'Hook name cannot be empty')
  .max(128, 'Hook name cannot exceed 128 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Hook name can only contain letters, numbers, hyphens, and underscores',
  )
  .refine(
    (name) => !['__proto__', 'constructor', 'prototype'].includes(name),
    'Hook name cannot be a reserved JavaScript object key (__proto__, constructor, prototype)',
  );

/**
 * Hook definition validation schema.
 *
 * Hook definitions must be objects. We use .passthrough() to allow
 * arbitrary keys for forward compatibility.
 */
const HOOK_DEFINITION_SCHEMA = z.object({}).passthrough();

/**
 * Hooks record validation schema.
 *
 * Maps hook names to their definitions.
 */
export const HOOKS_SCHEMA = z
  .record(HOOK_NAME_SCHEMA, HOOK_DEFINITION_SCHEMA)
  .optional();

/**
 * Inferred TypeScript type for validated hooks.
 */
export type Hooks = z.infer<typeof HOOKS_SCHEMA>;

/**
 * Validates a hooks object against the schema.
 *
 * @param hooks - The hooks object to validate
 * @throws ZodError if validation fails
 * @returns The validated hooks object
 */
export function validateHooks(
  hooks: Record<string, unknown> | undefined,
): Hooks {
  return HOOKS_SCHEMA.parse(hooks);
}
