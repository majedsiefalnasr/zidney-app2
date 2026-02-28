#!/usr/bin/env python3
"""
Fix tests/unit/products/test_service_logic.ts
"""
import re

ROOT = "/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2"
PATH = ROOT + "/tests/unit/products/test_service_logic.ts"

with open(PATH) as f:
    content = f.read()

# Fix 1: generateChangeSummary(old, new) → generateChangeSummary(computeFieldDiff(old, new))
# Pattern: generateChangeSummary(\n        oldX as any,\n        newX as any\n      )
content = re.sub(
    r'generateChangeSummary\(\s*\n(\s*)(\w+\s+as\s+any),\s*\n\s*(\w+\s+as\s+any)\s*\)',
    lambda m: f'generateChangeSummary(computeFieldDiff({m.group(2)}, {m.group(3)}))',
    content
)

# Also single-line version if any
content = re.sub(
    r'generateChangeSummary\((\w+\s+as\s+any),\s*(\w+\s+as\s+any)\)',
    r'generateChangeSummary(computeFieldDiff(\1, \2))',
    content
)

# Fix 2: diff.name.old → (diff.name! as any).old
# But we need: diff.name.old.en → ((diff.name! as any).old as any).en = (diff.name as any).old.en
# Simplest: use (diff as any).name.old.en everywhere
# Let's replace specific patterns:
# diff.name.old.en → (diff.name! as any).old.en
# diff.name.new.en → (diff.name! as any).new.en
content = re.sub(
    r'\bdiff\.(name|description|enabled_modules|status)\.old\.',
    r'(diff.\1 as any)!.old.',
    content
)
content = re.sub(
    r'\bdiff\.(name|description|enabled_modules|status)\.new\.',
    r'(diff.\1 as any)!.new.',
    content
)

# After above, fix remaining diff.X possibly undefined:
# diff.name!.X or diff.X?.X patterns for toBeDefined checks
# Replace: expect(diff.name).toBeDefined() → leave as is? diff.name is Record access, possibly undefined
# But for toBeDefined, we want to check if it's defined:
# expect(diff.name).toBeDefined() - the error is 'diff.name is possibly undefined' when used
# For simple cases where diff.name is only used in expect(...).toBeDefined() that's fine
# The errors at 249/250/262/263 are diff.enabled_modules
content = re.sub(
    r'\bdiff\.(enabled_modules)\.(old|new)\b',
    r'(diff.\1 as any)!.\2',
    content
)

# For lines 236/237: diff.name!.old.en type 'unknown' error
# Now content has (diff.name as any)!.old.en - but TS doesn't allow ! after )
# Instead use: (diff.name as any).old.en (no !)
content = content.replace('(diff.name as any)!.old.', '(diff.name as any).old.')
content = content.replace('(diff.name as any)!.new.', '(diff.name as any).new.')
content = content.replace('(diff.description as any)!.old.', '(diff.description as any).old.')
content = content.replace('(diff.description as any)!.new.', '(diff.description as any).new.')
content = content.replace('(diff.enabled_modules as any)!.old', '(diff.enabled_modules as any).old')
content = content.replace('(diff.enabled_modules as any)!.new', '(diff.enabled_modules as any).new')

with open(PATH, 'w') as f:
    f.write(content)

print("Fixed: test_service_logic.ts")

# Verify
with open(PATH) as f:
    new_content = f.read()
    count_generateChangeSummary = new_content.count('generateChangeSummary(computeFieldDiff(')
    count_old_style = new_content.count('generateChangeSummary(\n')
    print(f"  computeFieldDiff calls: {count_generateChangeSummary}")
    print(f"  old-style multi-line: {count_old_style}")
