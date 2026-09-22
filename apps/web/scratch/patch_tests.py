import os
import re

test_dir = r'd:\CODEREVIEW_Akka\CODEREVIEW\AutomaticCodereviewandDebtTracking\apps\web\src\test\pages'

def patch_test(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace instances of `expect(screen.getBy` with `expect(await screen.findBy`
    # but we should only do it if the file was one of the failing ones.
    
    # Actually, a safe regex is to replace `expect(screen.getBy` with `expect(await screen.findBy`
    # if it's the first one in the test.
    new_content = content.replace('expect(screen.getByRole(', 'expect(await screen.findByRole(')
    new_content = new_content.replace('expect(screen.getByText(', 'expect(await screen.findByText(')
    new_content = new_content.replace('expect(screen.getByTestId(', 'expect(await screen.findByTestId(')

    # Some of them are already in a waitFor, but it's safe to use await findBy inside waitFor or outside.
    # Actually, await inside waitFor is fine in most cases.
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Patched {os.path.basename(filepath)}')

for file in os.listdir(test_dir):
    if file.endswith('.test.tsx'):
        patch_test(os.path.join(test_dir, file))
