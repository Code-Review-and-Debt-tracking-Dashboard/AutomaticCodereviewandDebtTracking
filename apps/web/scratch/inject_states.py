import os
import re

pages_dir = r'd:\CODEREVIEW_Akka\CODEREVIEW\AutomaticCodereviewandDebtTracking\apps\web\src\pages'

def inject_states(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    has_loading = 'isLoading' in content
    has_error = 'error' in content

    if not has_loading and not has_error:
        return

    lines = content.split('\n')
    main_return_idx = -1
    for i in range(len(lines)-1, -1, -1):
        if re.match(r'^\s*return\s*\(', lines[i]):
            main_return_idx = i
            break
            
    if main_return_idx == -1:
        return

    if 'if (isLoading)' in content or '<LoadingState' in content:
        has_loading = False
    if 'if (error)' in content or '<ErrorState' in content:
        has_error = False

    injection = []
    
    if has_loading:
        injection.append('  if (isLoading) {')
        injection.append('    return (')
        injection.append('      <div className="flex min-h-screen items-center justify-center bg-background p-8">')
        injection.append('        <LoadingState className="w-full max-w-md" />')
        injection.append('      </div>')
        injection.append('    );')
        injection.append('  }')
  
    if has_error:
        injection.append('  if (error) {')
        injection.append('    return (')
        injection.append('      <div className="flex min-h-screen items-center justify-center bg-background p-8">')
        injection.append('        <ErrorState message={error} onRetry={() => window.location.reload()} className="w-full max-w-md" />')
        injection.append('      </div>')
        injection.append('    );')
        injection.append('  }')
  
    if injection:
        lines.insert(main_return_idx, '\n'.join(injection) + '\n')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f'Injected states into {os.path.basename(filepath)}')

for root, _, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.tsx') and 'test' not in root:
            inject_states(os.path.join(root, file))
