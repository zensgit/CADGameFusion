#!/usr/bin/env python3
"""
Export validation script for CADGameFusion
Validates the structure and consistency of exported JSON and glTF files
"""

import json
import os
import sys
import struct
import io
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Force UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

class ExportValidator:
    """Validates exported scene directories"""
    
    def __init__(self, scene_dir: str):
        self.scene_dir = Path(scene_dir)
        self.errors = []
        self.warnings = []
        self.info = []
        
    def validate(self) -> bool:
        """Main validation entry point"""
        print(f"[VALIDATE] Checking export directory: {self.scene_dir}")
        print("=" * 60)
        
        if not self.scene_dir.exists():
            self.errors.append(f"Directory does not exist: {self.scene_dir}")
            return False
        
        # Find all group JSON files
        json_files = list(self.scene_dir.glob("group_*.json"))
        gltf_files = list(self.scene_dir.glob("mesh_group_*.gltf"))
        
        print(f"[INFO] Found {len(json_files)} JSON files and {len(gltf_files)} glTF files")
        
        # Validate each JSON file
        for json_file in json_files:
            self.validate_json(json_file)
        
        # Validate each glTF file
        for gltf_file in gltf_files:
            self.validate_gltf(gltf_file)
        
        # Check consistency between JSON and glTF
        self.check_consistency(json_files, gltf_files)
        
        # Print results
        self.print_results()
        
        return len(self.errors) == 0
    
    def validate_json(self, json_path: Path) -> bool:
        """Validate a single JSON export file"""
        print(f"\n[JSON] Validating {json_path.name}...")
        
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
        except Exception as e:
            self.errors.append(f"{json_path.name}: Failed to parse JSON - {e}")
            return False
        
        # Check required fields (support both group_id and groupId)
        has_group_id = 'group_id' in data or 'groupId' in data
        if not has_group_id:
            self.errors.append(f"{json_path.name}: Missing required field 'group_id' or 'groupId'")
        else:
            group_field = 'group_id' if 'group_id' in data else 'groupId'
            self.info.append(f"  [OK] Has {group_field}")
        
        required_fields = ['flat_pts', 'ring_counts']
        for field in required_fields:
            if field not in data:
                self.errors.append(f"{json_path.name}: Missing required field '{field}'")
            else:
                self.info.append(f"  [OK] Has {field}")
        
        # Validate data consistency
        if 'flat_pts' in data and 'ring_counts' in data:
            flat_pts = data['flat_pts']
            ring_counts = data['ring_counts']
            
            # Handle both array format and object format for flat_pts
            if flat_pts and isinstance(flat_pts[0], dict):
                # Object format: [{"x": 0, "y": 0}, ...]
                actual_pts = len(flat_pts)
                self.info.append(f"  [OK] Points in object format (x,y)")
            elif flat_pts and isinstance(flat_pts[0], (int, float)):
                # Array format: [0, 0, 1, 0, ...]
                actual_pts = len(flat_pts) // 2
                self.info.append(f"  [OK] Points in array format")
            else:
                actual_pts = len(flat_pts) if flat_pts else 0
            
            if ring_counts:
                expected_pts = sum(ring_counts)
                
                if expected_pts != actual_pts:
                    self.errors.append(
                        f"{json_path.name}: Point count mismatch - "
                        f"expected {expected_pts} from ring_counts, got {actual_pts}"
                    )
                else:
                    self.info.append(f"  [OK] Point count consistent ({actual_pts} points in {len(ring_counts)} rings)")
        
        # Check optional fields
        if 'ring_roles' in data:
            roles = data['ring_roles']
            if 'ring_counts' in data and len(roles) != len(data['ring_counts']):
                self.warnings.append(
                    f"{json_path.name}: ring_roles count ({len(roles)}) "
                    f"doesn't match ring_counts ({len(data['ring_counts'])})"
                )
            else:
                self.info.append(f"  [OK] Has ring_roles ({len(roles)} roles)")
        
        if 'meta' in data:
            meta = data['meta']
            self.info.append(f"  [OK] Has meta: {list(meta.keys())}")
            
            # Validate meta fields from updated mainwindow.cpp
            expected_meta = ['joinType', 'miterLimit', 'unitScale', 'useDocUnit']
            for field in expected_meta:
                if field in meta:
                    self.info.append(f"    • {field}: {meta[field]}")
        
        return True
    
    def validate_gltf(self, gltf_path: Path) -> bool:
        """Validate a single glTF export file"""
        print(f"\n[GLTF] Validating {gltf_path.name}...")
        
        try:
            with open(gltf_path, 'r') as f:
                data = json.load(f)
        except Exception as e:
            self.errors.append(f"{gltf_path.name}: Failed to parse glTF - {e}")
            return False
        
        # Check glTF version
        if 'asset' not in data:
            self.errors.append(f"{gltf_path.name}: Missing 'asset' field")
        elif 'version' not in data['asset']:
            self.errors.append(f"{gltf_path.name}: Missing version in asset")
        else:
            version = data['asset']['version']
            if version != "2.0":
                self.warnings.append(f"{gltf_path.name}: Unexpected glTF version {version}")
            else:
                self.info.append(f"  [OK] glTF version 2.0")
        
        # Check required top-level properties
        required = ['buffers', 'bufferViews', 'accessors']
        for field in required:
            if field not in data:
                self.errors.append(f"{gltf_path.name}: Missing required field '{field}'")
            else:
                count = len(data[field]) if isinstance(data[field], list) else 0
                self.info.append(f"  [OK] Has {field} ({count} items)")
        
        # Check binary file exists
        bin_path = gltf_path.with_suffix('.bin')
        if not bin_path.exists():
            self.errors.append(f"{gltf_path.name}: Missing binary file {bin_path.name}")
        else:
            bin_size = bin_path.stat().st_size
            self.info.append(f"  [OK] Binary file exists ({bin_size} bytes)")
            
            # Validate buffer size matches binary
            if 'buffers' in data and data['buffers']:
                buffer = data['buffers'][0]
                if 'byteLength' in buffer:
                    if buffer['byteLength'] != bin_size:
                        self.errors.append(
                            f"{gltf_path.name}: Buffer size mismatch - "
                            f"glTF says {buffer['byteLength']}, binary is {bin_size}"
                        )
                    else:
                        self.info.append(f"  [OK] Buffer size matches binary")
        
        # Check meshes
        if 'meshes' in data and data['meshes']:
            mesh = data['meshes'][0]
            if 'primitives' in mesh and mesh['primitives']:
                prim = mesh['primitives'][0]
                
                # Check for required attributes
                if 'attributes' in prim:
                    if 'POSITION' in prim['attributes']:
                        self.info.append(f"  [OK] Has POSITION attribute")
                    else:
                        self.errors.append(f"{gltf_path.name}: Missing POSITION attribute")
                
                # Check primitive mode
                mode = prim.get('mode', 4)
                mode_names = {0: 'POINTS', 1: 'LINES', 2: 'LINE_LOOP', 
                             3: 'LINE_STRIP', 4: 'TRIANGLES', 5: 'TRIANGLE_STRIP', 
                             6: 'TRIANGLE_FAN'}
                self.info.append(f"  [OK] Primitive mode: {mode_names.get(mode, f'Unknown({mode})')}")

                # Full consistency checks
                try:
                    accessors = data.get('accessors', [])
                    bufferViews = data.get('bufferViews', [])
                    buffers = data.get('buffers', [])
                    if not buffers:
                        raise ValueError('no buffers')
                    pos_idx = prim.get('attributes',{}).get('POSITION', -1)
                    ind_idx = prim.get('indices', -1)
                    if isinstance(pos_idx, int) and isinstance(ind_idx, int) and pos_idx>=0 and ind_idx>=0:
                        pos_acc = accessors[pos_idx]
                        ind_acc = accessors[ind_idx]
                        pos_bv = bufferViews[pos_acc['bufferView']]
                        ind_bv = bufferViews[ind_acc['bufferView']]
                        # POSITION format and size
                        if not (pos_acc.get('componentType')==5126 and pos_acc.get('type')=='VEC3'):
                            self.errors.append(f"{gltf_path.name}: POSITION accessor wrong format")
                        pos_count = int(pos_acc.get('count',0))
                        exp_pos_bytes = pos_count * 3 * 4
                        if int(pos_bv.get('byteLength',0)) != exp_pos_bytes:
                            self.warnings.append(f"{gltf_path.name}: POSITION bufferView length {pos_bv.get('byteLength')} != {exp_pos_bytes}")
                        # Indices format and count
                        if not (ind_acc.get('componentType')==5125 and ind_acc.get('type')=='SCALAR'):
                            self.errors.append(f"{gltf_path.name}: indices accessor wrong format")
                        ind_count = int(ind_acc.get('count',0))
                        if ind_count <= 0 or ind_count % 3 != 0:
                            self.errors.append(f"{gltf_path.name}: indices count not multiple of 3: {ind_count}")
                        exp_ind_bytes = ind_count * 4
                        if int(ind_bv.get('byteLength',0)) != exp_ind_bytes:
                            self.warnings.append(f"{gltf_path.name}: indices bufferView length {ind_bv.get('byteLength')} != {exp_ind_bytes}")
                        # Full index range check
                        bin_path = gltf_path.with_suffix('.bin')
                        with open(bin_path, 'rb') as bf:
                            start = int(ind_bv.get('byteOffset',0)) + int(ind_acc.get('byteOffset',0))
                            bf.seek(start)
                            data_bytes = bf.read(exp_ind_bytes)
                        for i in range(0, len(data_bytes), 4):
                            idx = struct.unpack('<I', data_bytes[i:i+4])[0]
                            if idx >= pos_count:
                                self.errors.append(f"{gltf_path.name}: index {idx} out of range (verts={pos_count})")
                                break
                    else:
                        self.errors.append(f"{gltf_path.name}: Missing POSITION/indices accessors")
                except Exception as ex:
                    self.errors.append(f"{gltf_path.name}: consistency check failed: {ex}")
        
        return True
    
    def check_consistency(self, json_files: List[Path], gltf_files: List[Path]):
        """Check consistency between JSON and glTF exports"""
        print(f"\n[CHECK] Verifying consistency...")
        
        # Extract group IDs from filenames
        json_groups = set()
        for f in json_files:
            # Extract number from group_N.json
            name = f.stem  # 'group_0'
            if name.startswith('group_'):
                try:
                    group_id = int(name.split('_')[1])
                    json_groups.add(group_id)
                except (IndexError, ValueError):
                    pass
        
        gltf_groups = set()
        for f in gltf_files:
            # Extract number from mesh_group_N.gltf
            name = f.stem  # 'mesh_group_0'
            if name.startswith('mesh_group_'):
                try:
                    group_id = int(name.split('_')[2])
                    gltf_groups.add(group_id)
                except (IndexError, ValueError):
                    pass
        
        # Check if same groups are exported
        if json_groups and gltf_groups:
            if json_groups == gltf_groups:
                self.info.append(f"  [OK] Consistent group IDs: {sorted(json_groups)}")
            else:
                only_json = json_groups - gltf_groups
                only_gltf = gltf_groups - json_groups
                if only_json:
                    self.warnings.append(f"Groups only in JSON: {sorted(only_json)}")
                if only_gltf:
                    self.warnings.append(f"Groups only in glTF: {sorted(only_gltf)}")
    
    def print_results(self):
        """Print validation results"""
        print("\n" + "=" * 60)
        print("VALIDATION RESULTS")
        print("=" * 60)
        
        if self.info:
            print("\n[PASS] Valid items:")
            for msg in self.info:
                print(f"  {msg}")
        
        if self.warnings:
            print(f"\n[WARN] Warnings ({len(self.warnings)}):")
            for msg in self.warnings:
                print(f"  • {msg}")
        
        if self.errors:
            print(f"\n[ERROR] Errors ({len(self.errors)}):")
            for msg in self.errors:
                print(f"  • {msg}")
        
        print("\n" + "=" * 60)
        if self.errors:
            print("[FAIL] VALIDATION FAILED")
        elif self.warnings:
            print("[WARN] VALIDATION PASSED WITH WARNINGS")
        else:
            print("[PASS] VALIDATION PASSED")
        print("=" * 60)


def main():
    """Main entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Validate a CADGameFusion scene export directory")
    parser.add_argument('scene_dir', help='Path to scene directory')
    parser.add_argument('--schema', action='store_true', help='Validate JSON against schema if jsonschema is available')
    parser.add_argument('--stats-out', type=str, default='', help='Append concise stats for this scene to the given file')
    args = parser.parse_args()

    validator = ExportValidator(args.scene_dir)
    success = validator.validate()

    # Optional JSON Schema validation for group_*.json
    if args.schema:
        try:
            import jsonschema
            schema_path = Path(__file__).resolve().parents[1] / 'docs' / 'schemas' / 'export_group.schema.json'
            with open(schema_path, 'r') as sf:
                schema = json.load(sf)
            for jpath in sorted(Path(args.scene_dir).glob('group_*.json')):
                with open(jpath, 'r') as jf:
                    data = json.load(jf)
                jsonschema.validate(instance=data, schema=schema)
            print('[SCHEMA] JSON Schema validation passed')
        except ImportError:
            print('[SCHEMA] jsonschema not installed; skipping schema validation')
        except Exception as ex:
            print(f'[SCHEMA] Validation failed: {ex}')
            success = False

    # Optional stats output
    if args.stats_out:
        try:
            scene_path = Path(args.scene_dir)
            scene_name = scene_path.name
            # Compute stats
            json_files = sorted(scene_path.glob('group_*.json'))
            gltf_files = sorted(scene_path.glob('mesh_group_*.gltf'))
            json_groups = len(json_files)
            json_points = 0
            json_rings = 0
            for jf in json_files:
                with open(jf, 'r') as f:
                    d = json.load(f)
                rc = d.get('ring_counts', [])
                json_rings += len(rc)
                fp = d.get('flat_pts', [])
                if fp and isinstance(fp[0], dict):
                    json_points += len(fp)
                elif fp and isinstance(fp[0], (int, float)):
                    json_points += len(fp) // 2
            gltf_vertices = 0
            gltf_indices = 0
            for gf in gltf_files:
                try:
                    with open(gf, 'r') as f:
                        g = json.load(f)
                    prim = g.get('meshes', [{}])[0].get('primitives', [{}])[0]
                    pos_idx = prim.get('attributes', {}).get('POSITION', -1)
                    ind_idx = prim.get('indices', -1)
                    acc = g.get('accessors', [])
                    if isinstance(pos_idx, int) and pos_idx >= 0 and pos_idx < len(acc):
                        gltf_vertices += int(acc[pos_idx].get('count', 0))
                    if isinstance(ind_idx, int) and ind_idx >= 0 and ind_idx < len(acc):
                        gltf_indices += int(acc[ind_idx].get('count', 0))
                except Exception:
                    pass
            triangles = gltf_indices // 3 if gltf_indices else 0
            ok_flag = 'YES' if success else 'NO'
            line = f"scene={scene_name}, json_groups={json_groups}, json_points={json_points}, json_rings={json_rings}, gltf_vertices={gltf_vertices if gltf_files else 'NA'}, gltf_indices={gltf_indices if gltf_files else 'NA'}, triangles={triangles if gltf_files else 'NA'}, ok={ok_flag}\n"
            with open(args.stats_out, 'a', encoding='utf-8') as outf:
                outf.write(line)
        except Exception as ex:
            print(f"[STATS] Failed to write stats: {ex}")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
