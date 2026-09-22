import os
import re

pages_dir = r'd:\CODEREVIEW_Akka\CODEREVIEW\AutomaticCodereviewandDebtTracking\apps\web\src\pages'

def fix_imports(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # find all import { ... } from "../../components/ui"
    def replacer(match):
        imports_text = match.group(1)
        # split by comma, strip whitespace, remove empty
        items = [x.strip() for x in imports_text.split(',') if x.strip()]
        unique_items = []
        for item in items:
            if item not in unique_items:
                unique_items.append(item)
        new_imports = ',\n  '.join(unique_items)
        return f'import {{\n  {new_imports},\n}} from "../../components/ui";'

    # Using re.sub to replace the first occurrence
    # or all occurrences?
    pattern = r'import\s+\{([^}]+)\}\s+from\s+[\'"]../../components/ui[\'"];?'
    new_content = re.sub(pattern, replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed imports in {os.path.basename(filepath)}')

for root, _, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.tsx') and 'test' not in file:
            fix_imports(os.path.join(root, file))
