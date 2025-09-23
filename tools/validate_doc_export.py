#!/usr/bin/env python3
import json, sys, os

def main(path: str) -> int:
    if not os.path.exists(path):
        print(f"missing: {path}", file=sys.stderr)
        return 2
    with open(path, 'r') as f:
        data = json.load(f)
    polys = data.get('polygons')
    if not isinstance(polys, list) or not polys:
        print("invalid: polygons missing/empty", file=sys.stderr)
        return 3
    total = 0
    for i, p in enumerate(polys):
        pts = p.get('points')
        if not isinstance(pts, list) or len(pts) < 3:
            print(f"invalid polygon #{i}: <3 points", file=sys.stderr)
            return 4
        for j, xy in enumerate(pts):
            if not (isinstance(xy, list) and len(xy) == 2):
                print(f"invalid point #{j} in polygon #{i}", file=sys.stderr)
                return 5
        total += len(pts)
    print(f"OK polygons={len(polys)} total_points={total}")
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("usage: validate_doc_export.py <file.json>", file=sys.stderr)
        sys.exit(1)
    sys.exit(main(sys.argv[1]))

