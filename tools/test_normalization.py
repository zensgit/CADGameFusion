#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def signed_area(pts):
    a = 0.0
    n = len(pts)
    if n < 3:
        return 0.0
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i+1) % n]
        a += x0*y1 - x1*y0
    return 0.5 * a

def lex_min(pt_list):
    return min(pt_list, key=lambda p: (p[0], p[1])) if pt_list else None

def check_group(json_path: Path) -> list[str]:
    errs = []
    data = json.loads(json_path.read_text())
    pts = data.get('flat_pts', [])
    if not pts:
        return errs
    # normalize point format to list of (x,y)
    if isinstance(pts[0], dict):
        flat = [(float(p.get('x', 0.0)), float(p.get('y', 0.0))) for p in pts]
    else:
        flat = []
        for i in range(0, len(pts), 2):
            flat.append((float(pts[i]), float(pts[i+1])))
    counts = data.get('ring_counts', [])
    roles = data.get('ring_roles', [])
    # meta.normalize checks
    norm = (data.get('meta') or {}).get('normalize', {})
    if not isinstance(norm, dict) or 'orientation' not in norm or 'start' not in norm or 'sortRings' not in norm:
        errs.append(f"{json_path.name}: meta.normalize missing or incomplete")
    for idx, cnt in enumerate(counts):
        start = sum(counts[:idx])
        ring = flat[start:start+cnt]
        if not ring:
            continue
        area = signed_area(ring)
        role = roles[idx] if idx < len(roles) else (0 if idx == 0 else 1)
        # outer desired CCW => area > 0, hole desired CW => area < 0
        if role == 0 and area <= 0:
            errs.append(f"{json_path.name}: ring {idx} expected CCW (area>0), got area={area}")
        if role == 1 and area >= 0:
            errs.append(f"{json_path.name}: ring {idx} expected CW (area<0), got area={area}")
        # start vertex lexicographic minimal
        if ring[0] != lex_min(ring):
            errs.append(f"{json_path.name}: ring {idx} start vertex is not lexicographic minimum")
    return errs

def main():
    if len(sys.argv) < 2:
        print("Usage: test_normalization.py <exports_root>")
        return 2
    root = Path(sys.argv[1])
    failures = []
    for scene_dir in sorted(root.glob('scene_cli_*')):
        for gp in sorted(Path(scene_dir).glob('group_*.json')):
            failures.extend(check_group(gp))
    if failures:
        print("Normalization checks FAILED:")
        for e in failures:
            print(" -", e)
        return 1
    print("Normalization checks passed")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

