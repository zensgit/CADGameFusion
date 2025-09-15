#!/usr/bin/env python3
"""
Compare Export to Sample - Structure Consistency Checker
Compares CLI-generated scenes with sample_exports for structural consistency.
Uses loose comparison to avoid false positives from triangulation differences.
"""
import os, sys, json, glob
from pathlib import Path

class Colors:
    """Terminal colors for better output readability"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def load_json(path: Path):
    """Load JSON file with error handling"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"{Colors.RED}[ERR] Failed to load {path}: {e}{Colors.RESET}")
        return None

def list_groups(scene_dir: Path, kind: str):
    """List group files by type (json or gltf)"""
    pattern = 'group_*.json' if kind=='json' else 'mesh_group_*.gltf'
    return sorted([p for p in scene_dir.glob(pattern)])

def compare_json(sample_dir: Path, gen_dir: Path) -> bool:
    """Compare JSON structure between sample and generated exports"""
    ok = True
    print(f"\n{Colors.BOLD}[JSON Comparison]{Colors.RESET}")
    
    s_groups = list_groups(sample_dir, 'json')
    g_groups = list_groups(gen_dir, 'json')
    s_ids = [int(p.stem.split('_')[1]) for p in s_groups]
    g_ids = [int(p.stem.split('_')[1]) for p in g_groups]
    
    # Check group IDs match
    if set(s_ids) != set(g_ids):
        print(f"{Colors.YELLOW}[WARN] JSON group IDs differ: sample={s_ids}, gen={g_ids}{Colors.RESET}")
        # Continue with intersection for loose comparison
    
    for sid in sorted(set(s_ids).intersection(g_ids)):
        sj = load_json(sample_dir / f"group_{sid}.json")
        gj = load_json(gen_dir / f"group_{sid}.json")
        
        if not sj or not gj:
            ok = False
            continue
        
        print(f"  Checking group_{sid}.json...")
        
        # Check group_id/groupId (both forms for compatibility)
        s_gid = sj.get('group_id', sj.get('groupId'))
        g_gid = gj.get('group_id', gj.get('groupId'))
        if s_gid != g_gid:
            print(f"{Colors.RED}    [ERR] Group ID mismatch: sample={s_gid}, gen={g_gid}{Colors.RESET}")
            ok = False
        
        # Check ring_counts
        s_rc = sj.get('ring_counts', [])
        g_rc = gj.get('ring_counts', [])
        if s_rc != g_rc:
            print(f"{Colors.YELLOW}    [WARN] ring_counts differ: sample={s_rc}, gen={g_rc}{Colors.RESET}")
            # Not a failure for loose comparison if structure is similar
        
        # Check ring_roles
        s_rr = sj.get('ring_roles', [])
        g_rr = gj.get('ring_roles', [])
        if s_rr != g_rr:
            print(f"{Colors.YELLOW}    [WARN] ring_roles differ: sample={s_rr}, gen={g_rr}{Colors.RESET}")
        
        # Check flat_pts count (loose - only check existence and non-empty)
        s_pts = len(sj.get('flat_pts', []))
        g_pts = len(gj.get('flat_pts', []))
        if g_pts <= 0:
            print(f"{Colors.RED}    [ERR] Generated flat_pts empty{Colors.RESET}")
            ok = False
        elif abs(s_pts - g_pts) > max(s_pts, g_pts) * 0.2:  # Allow 20% difference
            print(f"{Colors.YELLOW}    [WARN] Point count differs significantly: sample={s_pts}, gen={g_pts}{Colors.RESET}")
        
        # Check meta structure (existence only, not values)
        s_meta = sj.get('meta', {})
        g_meta = gj.get('meta', {})
        s_meta_keys = set(s_meta.keys())
        g_meta_keys = set(g_meta.keys())
        
        if s_meta_keys != g_meta_keys:
            missing = s_meta_keys - g_meta_keys
            extra = g_meta_keys - s_meta_keys
            if missing:
                print(f"{Colors.YELLOW}    [WARN] Missing meta keys: {missing}{Colors.RESET}")
            if extra:
                print(f"{Colors.BLUE}    [INFO] Extra meta keys: {extra}{Colors.RESET}")
        
        print(f"{Colors.GREEN}    ✓ Structure check passed{Colors.RESET}")
    
    return ok

def compare_gltf(sample_dir: Path, gen_dir: Path) -> bool:
    """Compare glTF structure between sample and generated exports"""
    ok = True
    print(f"\n{Colors.BOLD}[glTF Comparison]{Colors.RESET}")
    
    s_groups = list_groups(sample_dir, 'gltf')
    g_groups = list_groups(gen_dir, 'gltf')
    
    # Handle case where there might be no glTF files (e.g., multi scene)
    if not g_groups and not s_groups:
        print(f"  {Colors.BLUE}No glTF files in either directory (expected for some scenes){Colors.RESET}")
        return True
    
    s_ids = [int(p.stem.split('_')[2]) for p in s_groups]
    g_ids = [int(p.stem.split('_')[2]) for p in g_groups]
    
    if set(s_ids) != set(g_ids):
        print(f"{Colors.YELLOW}[WARN] glTF group IDs differ: sample={s_ids}, gen={g_ids}{Colors.RESET}")
        # Continue with intersection for loose comparison
    
    for sid in sorted(set(s_ids).intersection(g_ids)):
        sj = load_json(sample_dir / f"mesh_group_{sid}.gltf")
        gj = load_json(gen_dir / f"mesh_group_{sid}.gltf")
        
        if not sj or not gj:
            ok = False
            continue
        
        print(f"  Checking mesh_group_{sid}.gltf...")
        
        try:
            # Check glTF version
            s_ver = sj.get('asset', {}).get('version')
            g_ver = gj.get('asset', {}).get('version')
            if s_ver != g_ver:
                print(f"{Colors.YELLOW}    [WARN] glTF version: sample={s_ver}, gen={g_ver}{Colors.RESET}")
            
            # Check POSITION accessor
            s_prim = sj['meshes'][0]['primitives'][0]
            g_prim = gj['meshes'][0]['primitives'][0]
            
            s_pos_idx = s_prim['attributes']['POSITION']
            g_pos_idx = g_prim['attributes']['POSITION']
            
            s_pos = sj['accessors'][s_pos_idx]['count']
            g_pos = gj['accessors'][g_pos_idx]['count']
            
            if g_pos <= 0:
                print(f"{Colors.RED}    [ERR] POSITION count <= 0: {g_pos}{Colors.RESET}")
                ok = False
            elif s_pos != g_pos:
                # For loose comparison, allow some difference
                print(f"{Colors.YELLOW}    [WARN] Vertex count differs: sample={s_pos}, gen={g_pos}{Colors.RESET}")
            
            # Check indices
            s_idx_accessor = s_prim.get('indices')
            g_idx_accessor = g_prim.get('indices')
            
            if s_idx_accessor is not None and g_idx_accessor is not None:
                s_idx = sj['accessors'][s_idx_accessor]['count']
                g_idx = gj['accessors'][g_idx_accessor]['count']
                
                if g_idx <= 0 or g_idx % 3 != 0:
                    print(f"{Colors.RED}    [ERR] Invalid triangle indices count: {g_idx}{Colors.RESET}")
                    ok = False
                elif abs(s_idx - g_idx) > 6:  # Allow small differences in triangulation
                    print(f"{Colors.YELLOW}    [WARN] Index count differs: sample={s_idx}, gen={g_idx} (triangulation difference){Colors.RESET}")
            
            # Check primitive mode (should be 4 = TRIANGLES)
            s_mode = s_prim.get('mode', 4)
            g_mode = g_prim.get('mode', 4)
            if g_mode != 4:
                print(f"{Colors.RED}    [ERR] Primitive mode not TRIANGLES: {g_mode}{Colors.RESET}")
                ok = False
            
            print(f"{Colors.GREEN}    ✓ Structure check passed{Colors.RESET}")
            
        except (KeyError, IndexError, TypeError) as e:
            print(f"{Colors.RED}    [ERR] Invalid glTF structure: {e}{Colors.RESET}")
            ok = False
    
    return ok

def main():
    if len(sys.argv) < 3:
        print(f"{Colors.BOLD}Usage: {sys.argv[0]} <generated_scene_dir> <sample_scene_dir>{Colors.RESET}")
        print(f"Example: {sys.argv[0]} build/exports/scene_cli_sample sample_exports/scene_sample")
        return 2
    
    gen = Path(sys.argv[1])
    sample = Path(sys.argv[2])
    
    if not gen.exists():
        print(f"{Colors.RED}[ERR] Generated directory not found: {gen}{Colors.RESET}")
        return 1
    
    if not sample.exists():
        print(f"{Colors.RED}[ERR] Sample directory not found: {sample}{Colors.RESET}")
        return 1
    
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}    Export Structure Comparison (Loose Mode){Colors.RESET}")
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"Generated: {gen}")
    print(f"Sample:    {sample}")
    
    ok1 = compare_json(sample, gen)
    ok2 = compare_gltf(sample, gen)
    
    print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
    if ok1 and ok2:
        print(f"{Colors.GREEN}[RESULT] ✅ STRUCTURE MATCH - All checks passed{Colors.RESET}")
        print(f"{Colors.GREEN}Structure is consistent (triangulation differences ignored){Colors.RESET}")
    else:
        print(f"{Colors.YELLOW}[RESULT] ⚠️  STRUCTURE ISSUES - Some checks failed{Colors.RESET}")
        print(f"{Colors.YELLOW}Review warnings above for details{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}")
    
    return 0 if (ok1 and ok2) else 1

if __name__ == '__main__':
    sys.exit(main())

