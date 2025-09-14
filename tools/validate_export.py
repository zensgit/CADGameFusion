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
        
        # Check required fields
        required_fields = ['group_id', 'flat_pts', 'ring_counts']
        for field in required_fields:
            if field not in data:
                self.errors.append(f"{json_path.name}: Missing required field '{field}'")
            else:
                self.info.append(f"  [OK] Has {field}")
        
        # Validate data consistency
        if 'flat_pts' in data and 'ring_counts' in data:
            flat_pts = data['flat_pts']
            ring_counts = data['ring_counts']
            
            if ring_counts:
                expected_pts = sum(ring_counts)
                actual_pts = len(flat_pts)
                
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
    if len(sys.argv) < 2:
        print("Usage: python validate_export.py <scene_directory>")
        print("Example: python validate_export.py scene_20240914_123456")
        sys.exit(1)
    
    scene_dir = sys.argv[1]
    validator = ExportValidator(scene_dir)
    
    success = validator.validate()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()