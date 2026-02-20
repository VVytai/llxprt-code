#!/bin/bash
# Run this script to complete R1 commit
git add -A
git commit -m 'refactor(core): MessageBus always enabled + B2 type fixes'
rm -f SHELL_BLOCKED_README.md commit_r1.sh
echo "R1 committed successfully"
