#!/usr/bin/env python3
"""
Auto-fixer for common TypeScript errors in test files.
Processes error log and applies targeted fixes.
"""
import sys
import re
import os
from collections import defaultdict

ROOT = "/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2"

def add_non_null_at(lines, lineno, colno):
    """Add ! non-null assertion at the end of the expression ending at col (0-indexed)."""
    # lineno is 1-based, colno is 1-based
    line = lines[lineno - 1]
    # Find the best insertion point - after the ] or ) that causes the error
    # The error col points to the start of the expression, e.g. result.arr[0]
    # We need to find the matching ] or ) 
    # Strategy: from col, scan forward to find what follows
    col_idx = colno - 1  # 0-based
    
    # Look for array access pattern: find the [i] or (x) bracket balance
    pos = col_idx
    while pos < len(line):
        if line[pos] == '[':
            # Find matching ]
            depth = 1
            pos += 1
            while pos < len(line) and depth > 0:
                if line[pos] == '[':
                    depth += 1
                elif line[pos] == ']':
                    depth -= 1
                pos += 1
            # pos is now after the ]
            # Insert ! here if not already there
            if pos < len(line) and line[pos] == '!':
                return  # Already fixed
            # But only insert if this is followed by . or ( (object access)
            if pos < len(line) and line[pos] in '.(':
                lines[lineno - 1] = line[:pos] + '!' + line[pos:]
            elif pos == len(line) or line[pos] in ',;)]\n':
                # End of expression - insert !
                lines[lineno - 1] = line[:pos] + '!' + line[pos:]
            return
        elif line[pos] == '.':
            break
        elif line[pos] in ' \t':
            pos += 1
            continue
        else:
            pos += 1

def fix_pool_null(lines):
    """Add ! after getTenantPool(...) or getMasterPool(...) calls in assignment."""
    changed = False
    for i, line in enumerate(lines):
        # Pattern: const/let/var pool = getXPool(...) without trailing !
        if re.search(r'= get\w+Pool\(', line) and '!' not in line.split('get')[1].split('Pool')[1].split(')')[0] + ')':
            # Add ! after closing ) of the Pool call
            def replace_pool(m):
                return m.group(0) + '!'
            newline = re.sub(r'(= get\w+Pool\([^)]*\))(?![\s]*!)', 
                           lambda m: m.group(1) + '!',
                           line)
            if newline != line:
                lines[i] = newline
                changed = True
    return changed

def fix_array_access(lines, lineno):
    """Add ! after array[index] patterns on a specific line."""
    line = lines[lineno - 1]
    # Replace patterns like arr[0]. with arr[0]!. 
    # But avoid double-!! and avoid breaking existing !
    newline = re.sub(r'(\[\d+\])(?!!)(?=\.)', r'\1!', line)
    if newline != line:
        lines[lineno - 1] = newline
        return True
    # Also handle arr[variable]. patterns
    newline = re.sub(r'(\[[a-zA-Z_][a-zA-Z0-9_.]*\])(?!!)(?=\.)', r'\1!', newline)
    if newline != lines[lineno - 1]:
        lines[lineno - 1] = newline
        return True
    return False


def process_file(filepath, error_lines_cols):
    """Process a file with the given {lineno: [colno]} error locations."""
    full_path = os.path.join(ROOT, filepath) if not filepath.startswith('/') else filepath
    
    if not os.path.exists(full_path):
        print(f"  NOT FOUND: {full_path}")
        return 0
    
    with open(full_path, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    original_lines = list(lines)
    changes = 0
    
    # Fix 1: Pool null checks (TS18047)
    if fix_pool_null(lines):
        changes += 1
    
    # Fix 2: Array indexing (TS2532/TS18048) at specific lines
    for lineno in sorted(error_lines_cols.keys()):
        if fix_array_access(lines, lineno):
            changes += 1
    
    if changes > 0:
        new_content = '\n'.join(lines)
        with open(full_path, 'w') as f:
            f.write(new_content)
        print(f"  FIXED ({changes} changes): {filepath}")
    else:
        print(f"  NO CHANGES: {filepath}")
    
    return changes


def parse_errors(error_file):
    """Parse TypeScript error file and group by file."""
    files = defaultdict(lambda: defaultdict(list))
    
    with open(error_file) as f:
        for line in f:
            line = line.strip()
            # Format: path/to/file.ts(lineno,colno): error TSxxxx: ...
            m = re.match(r'^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$', line)
            if m:
                filepath = m.group(1)
                lineno = int(m.group(2))
                colno = int(m.group(3))
                errcode = m.group(4)
                errmsg = m.group(5)
                files[filepath][lineno].append({
                    'col': colno,
                    'code': errcode,
                    'msg': errmsg
                })
    
    return files


if __name__ == '__main__':
    error_file = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ts-errors-current.txt'
    
    print(f"Processing errors from: {error_file}")
    files = parse_errors(error_file)
    
    total_fixed = 0
    skip_files = {
        'packages/ui-system/tests/unit/composables.spec.ts',
        'packages/ui-system/tests/unit/utilities.spec.ts',
    }
    
    for filepath, line_errors in sorted(files.items()):
        if any(filepath.endswith(s) or filepath == s for s in skip_files):
            print(f"  SKIPPING (manual rewrite needed): {filepath}")
            continue
        
        # Check if has relevant errors
        has_pool = any(
            e['code'] == 'TS18047' 
            for lineno in line_errors.values()
            for e in lineno
        )
        has_arr = any(
            e['code'] in ('TS2532', 'TS18048')
            for lineno in line_errors.values()
            for e in lineno
        )
        
        if has_pool or has_arr:
            result = process_file(filepath, 
                                   {ln: errs for ln, errs in line_errors.items()})
            total_fixed += result
    
    print(f"\nTotal files fixed: {total_fixed}")
