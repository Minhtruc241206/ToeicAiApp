import json

def getList():
    with open("data/data.json", encoding="utf-8") as f:
        return json.load(f)
