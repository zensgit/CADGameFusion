#!/usr/bin/env python3
"""
Field-level comparison for CADGameFusion scene exports.
Compares two scene directories (CLI vs sample) for strict numeric equality
with tolerance on coordinates and ring structure.

Usage:
  python3 tools/compare_fields.py <left_scene_dir> <right_scene_dir> [--rtol 1e-6] [--json-out report.json]

Checks:
  - group_* presence and matching group_id sets
  - For each group: ring_counts, ring_roles (if present), flat_pts length
  - Coordinates equality with tolerance (object or array format)
  - glTF presence for both or neither; if both, POSITION and indices accessor counts match
"""

import argparse
import json
from pathlib import Path
from typing import List, Tuple, Dict


def load_group_files(scene_dir: Path) -> Dict[int, Path]:
    out: Dict[int, Path] = {}
    for p in sorted(scene_dir.glob('group_*.json')):
        try:
            gid = int(p.stem.split('_')[1])
        except Exception:
            continue
        out[gid] = p
    return out


def load_points(d) -> List[Tuple[float, float]]:
    pts = d.get('flat_pts', [])
    out: List[Tuple[float, float]] = []
    if not pts:
        return out
    if isinstance(pts[0], dict):
        for o in pts:
            out.append((float(o.get('x', 0.0)), float(o.get('y', 0.0))))
    else:
        # flat array of numbers
        for i in range(0, len(pts), 2):
            out.append((float(pts[i]), float(pts[i+1])))
    return out


def nearly_equal(a: float, b: float, rtol: float) -> bool:
    da = abs(a - b)
    tol = rtol * max(1.0, abs(a), abs(b))
    return da <= tol


def compare_json_groups(lpath: Path, rpath: Path, rtol: float, mode: str, check_meta: bool, errors: List[str]):
    ld = json.load(open(lpath, 'r'))
    rd = json.load(open(rpath, 'r'))

    # ring_counts
    lrc = ld.get('ring_counts', [])
    rrc = rd.get('ring_counts', [])
    if lrc != rrc:
        errors.append(f"{lpath.name}: ring_counts mismatch {lrc} != {rrc}")

    # ring_roles (optional) - only check in full mode
    if mode != 'counts-only':
        lrr = ld.get('ring_roles', None)
        rrr = rd.get('ring_roles', None)
        if (lrr is None) != (rrr is None):
            errors.append(f"{lpath.name}: ring_roles presence mismatch")
        elif lrr is not None and rrr is not None and lrr != rrr:
            errors.append(f"{lpath.name}: ring_roles mismatch {lrr} != {rrr}")

    # points length
    lp = load_points(ld)
    rp = load_points(rd)
    if len(lp) != len(rp):
        errors.append(f"{lpath.name}: point count mismatch {len(lp)} != {len(rp)}")
    elif mode != 'counts-only':
        for i, (a, b) in enumerate(zip(lp, rp)):
            if not (nearly_equal(a[0], b[0], rtol) and nearly_equal(a[1], b[1], rtol)):
                errors.append(f"{lpath.name}: point[{i}] mismatch {a} != {b} (rtol={rtol})")
                break

    # meta checks (joinType, miterLimit, useDocUnit) if requested
    if check_meta:
        lm = ld.get('meta', {}) or {}
        rm = rd.get('meta', {}) or {}
        # Only compare keys that exist in both, to be robust
        for key in ['joinType', 'useDocUnit']:
            if key in lm and key in rm:
                if lm[key] != rm[key]:
                    errors.append(f"{lpath.name}: meta.{key} mismatch {lm[key]} != {rm[key]}")
        # miterLimit as float with tolerance
        if 'miterLimit' in lm and 'miterLimit' in rm:
            if not nearly_equal(float(lm['miterLimit']), float(rm['miterLimit']), rtol):
                errors.append(f"{lpath.name}: meta.miterLimit mismatch {lm['miterLimit']} != {rm['miterLimit']}")
        # unitScale as float with tolerance
        if 'unitScale' in lm and 'unitScale' in rm:
            if not nearly_equal(float(lm['unitScale']), float(rm['unitScale']), rtol):
                errors.append(f"{lpath.name}: meta.unitScale mismatch {lm['unitScale']} != {rm['unitScale']}")


def compare_gltf_counts(ldir: Path, rdir: Path, errors: List[str], allow_mismatch: bool = False):
    # Expect both to have mesh_group_*.gltf or neither.
    lmeshes = sorted(ldir.glob('mesh_group_*.gltf'))
    rmeshes = sorted(rdir.glob('mesh_group_*.gltf'))
    if bool(lmeshes) != bool(rmeshes):
        if allow_mismatch:
            return
        else:
            errors.append("glTF presence mismatch between scenes")
            return
    if not lmeshes:
        return
    # Compare per group by extracting id from filename
    def to_map(files: List[Path]) -> Dict[int, Path]:
        m: Dict[int, Path] = {}
        for p in files:
            try:
                gid = int(p.stem.split('_')[2])
            except Exception:
                continue
            m[gid] = p
        return m
    lm = to_map(lmeshes)
    rm = to_map(rmeshes)
    if set(lm.keys()) != set(rm.keys()):
        errors.append(f"glTF group id set mismatch: {sorted(lm.keys())} != {sorted(rm.keys())}")
        return
    for gid in sorted(lm.keys()):
        lg = json.load(open(lm[gid], 'r'))
        rg = json.load(open(rm[gid], 'r'))
        def counts(g):
            prim = g.get('meshes', [{}])[0].get('primitives', [{}])[0]
            acc = g.get('accessors', [])
            pos_idx = prim.get('attributes', {}).get('POSITION', -1)
            ind_idx = prim.get('indices', -1)
            v = acc[pos_idx]['count'] if isinstance(pos_idx, int) and 0 <= pos_idx < len(acc) else None
            i = acc[ind_idx]['count'] if isinstance(ind_idx, int) and 0 <= ind_idx < len(acc) else None
            return v, i
        lv, li = counts(lg)
        rv, ri = counts(rg)
        if lv != rv or li != ri:
            errors.append(f"mesh_group_{gid}.gltf counts mismatch: verts {lv} vs {rv}, indices {li} vs {ri}")


def main() -> int:
    ap = argparse.ArgumentParser(description='Field-level comparison for CADGameFusion scenes')
    ap.add_argument('left', help='Left scene directory (e.g., CLI)')
    ap.add_argument('right', help='Right scene directory (e.g., sample)')
    ap.add_argument('--rtol', type=float, default=1e-6, help='Relative tolerance for float comparisons')
    ap.add_argument('--json-out', type=str, default='', help='Write detailed JSON report to this path')
    ap.add_argument('--allow-gltf-mismatch', action='store_true', help='Do not fail when glTF presence differs')
    ap.add_argument('--mode', type=str, default='full', choices=['full','counts-only'], help='Comparison mode')
    ap.add_argument('--meta-mode', type=str, default='auto', choices=['auto','on','off'], help='Meta comparison mode: auto(full only), on(always), off(never)')
    args = ap.parse_args()

    ldir = Path(args.left)
    rdir = Path(args.right)
    if not ldir.is_dir() or not rdir.is_dir():
        print('[ERROR] Both paths must be scene directories')
        return 2

    lgroups = load_group_files(ldir)
    rgroups = load_group_files(rdir)

    errors: List[str] = []
    if set(lgroups.keys()) != set(rgroups.keys()):
        errors.append(f"Group id set mismatch: {sorted(lgroups.keys())} != {sorted(rgroups.keys())}")
    else:
        # determine meta check flag
        def should_check_meta() -> bool:
            if args.meta_mode == 'on':
                return True
            if args.meta_mode == 'off':
                return False
            # auto
            return args.mode != 'counts-only'
        cm = should_check_meta()
        for gid in sorted(lgroups.keys()):
            compare_json_groups(lgroups[gid], rgroups[gid], args.rtol, args.mode, cm, errors)

    # glTF count checks
    compare_gltf_counts(ldir, rdir, errors, allow_mismatch=args.allow_gltf_mismatch)

    # Build JSON report if requested
    if args.json_out:
        report = {
            'left': str(ldir),
            'right': str(rdir),
            'rtol': args.rtol,
            'mode': args.mode,
            'meta_mode': args.meta_mode,
            'status': 'passed' if not errors else 'failed',
            'errors': errors.copy(),
            'left_groups': sorted(lgroups.keys()),
            'right_groups': sorted(rgroups.keys()),
        }
        # glTF group sets snapshot
        def gltf_groups(d: Path):
            out = []
            for p in d.glob('mesh_group_*.gltf'):
                try:
                    out.append(int(p.stem.split('_')[2]))
                except Exception:
                    pass
            return sorted(out)
        report['left_gltf_groups'] = gltf_groups(ldir)
        report['right_gltf_groups'] = gltf_groups(rdir)

        try:
            Path(args.json_out).parent.mkdir(parents=True, exist_ok=True)
            with open(args.json_out, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
        except Exception as ex:
            print(f"[WARN] Failed to write JSON report: {ex}")

    if errors:
        print('FIELD COMPARISON FAILED:')
        for e in errors:
            print(' -', e)
        return 1
    print('FIELD COMPARISON PASSED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
