#!/usr/bin/env python3
"""
Fix corrupted test files that have duplicate `import { Module } from '@zidney/types/enums/Module'` lines.
Strategy:
1. Remove ALL existing occurrences of the target import line
2. Find the right insertion point (after last @zidney/types import)
3. Insert one clean copy
"""
import sys
import re

TARGET_IMPORT = "import { Module } from '@zidney/types/enums/Module'"

def fix_file(path: str):
    with open(path, 'r') as f:
        lines = f.readlines()
    
    # Remove ALL occurrences of the target import line
    cleaned = [line for line in lines if line.strip() != TARGET_IMPORT]
    
    # Check if we still need to add the import (i.e., Module. is used)
    content = ''.join(cleaned)
    if 'Module.' not in content:
        # File doesn't use Module enum, skip
        print(f"  SKIP (no Module. refs): {path}")
        with open(path, 'w') as f:
            f.writelines(cleaned)
        return
    
    # Find insertion point: after last @zidney/types import line
    insert_after = -1
    for i, line in enumerate(cleaned):
        if "from '@zidney/types" in line or 'from "@zidney/types' in line:
            insert_after = i
    
    if insert_after == -1:
        # No @zidney/types import, insert after first import
        for i, line in enumerate(cleaned):
            if line.startswith('import '):
                insert_after = i
                break
    
    if insert_after == -1:
        # Fallback: insert at start
        cleaned.insert(0, TARGET_IMPORT + '\n')
    else:
        cleaned.insert(insert_after + 1, TARGET_IMPORT + '\n')
    
    with open(path, 'w') as f:
        f.writelines(cleaned)
    
    print(f"  FIXED: {path}")

if __name__ == '__main__':
    for path in sys.argv[1:]:
        fix_file(path)
