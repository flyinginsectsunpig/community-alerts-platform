import urllib.request, json
url = "https://raw.githubusercontent.com/redhat-developer/vscode-java/master/package.json"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read())

props = data['contributes']['configuration']['properties']
if 'java.configuration.runtimes' in props:
    runtimes = props['java.configuration.runtimes']
    names_anyOf = runtimes['items']['properties']['name']['anyOf']
    for entry in names_anyOf:
        print(entry)
else:
    print("Not found")
