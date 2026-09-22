import os
import re

pages_dir = r'd:\CODEREVIEW_Akka\CODEREVIEW\AutomaticCodereviewandDebtTracking\apps\web\src\pages'
ui_components = [
    'BackLink', 'Badge', 'Card', 'CardHeader', 'CardTitle', 'CardDescription', 
    'CardContent', 'CardFooter', 'Button', 'IconBox', 'StatCard', 'PageHeader', 
    'PageHeaderBadge', 'PageHeaderTitle', 'PageHeaderDescription', 'PageHeaderActions', 
    'FilterBar', 'Select', 'TabGroup', 'NotificationItem', 'EmptyState', 'LoadingState', 
    'ErrorState', 'DataTable', 'DataTableHead', 'DataTableBody', 'DataTableRow', 
    'DataTableHeaderCell', 'DataTableCell'
]

for root, _, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.tsx') and 'test' not in file:
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            pattern = r'import\s+\{([^}]+)\}\s+from\s+[\'"](?:../../|../)?components/ui[\'"];?'
            match = re.search(pattern, content)
            
            if match:
                used = []
                for comp in ui_components:
                    content_without_import = content[:match.start()] + content[match.end():]
                    if re.search(r'<\b' + comp + r'\b', content_without_import) or re.search(r'\b' + comp + r'\b(?!\s*\})', content_without_import):
                        used.append(comp)
                
                if not used: continue
                new_imports = ',\n  '.join(used)
                new_block = f'import {{\n  {new_imports},\n}} from "../../components/ui";'
                
                new_content = content[:match.start()] + new_block + content[match.end():]
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed full imports in {file}')
