import os, re
import sys

java_src = r"c:\community-alerts-platform\services\java-api\src\main\java"

for root, dirs, files in os.walk(java_src):
    for f in files:
        if f.endswith(".java"):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Find all imports
            imports = re.findall(r'^import\s+(static\s+)?([\w\.]+)\.([A-Z]\w*|\*);', content, re.MULTILINE)
            
            content_without_imports = re.sub(r'^import\s+.*$', '', content, flags=re.MULTILINE)
            content_without_comments = re.sub(r'//.*$', '', content_without_imports, flags=re.MULTILINE)
            content_without_comments = re.sub(r'/\*.*?\*/', '', content_without_comments, flags=re.DOTALL)
            
            for imp in imports:
                is_static, pkg, cls = imp
                if cls != '*':
                    if not re.search(r'\b' + cls + r'\b', content_without_comments):
                        print(f"{path}: Unused import {pkg}.{cls}")
