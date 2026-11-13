import json
from collections import defaultdict

from model import Topic,Word


def getList():
    with open("data/data2.json", encoding="utf-8") as f:
        return json.load(f)

def get50topic():
    return Topic.query.all()

