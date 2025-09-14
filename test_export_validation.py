#!/usr/bin/env python3
"""Export validation test script for CADGameFusion"""

import json
import os
import sys
from pathlib import Path

def validate_json_export(json_path):
    """Validate JSON export file structure"""
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    results = {
        'file': json_path.name,
        'valid': True,
        'checks': {}
    }
    
    # Check required fields
    required = ['group_id', 'flat_pts', 'ring_counts']
    for field in required:
        results['checks'][field] = field in data
        if not results['checks'][field]:
            results['valid'] = False
    
    # Check optional fields
    results['checks']['has_meta'] = 'meta' in data
    results['checks']['has_ring_roles'] = 'ring_roles' in data
    
    # Validate meta if present
    if 'meta' in data:
        meta = data['meta']
        results['meta'] = {
            'joinType': meta.get('joinType', 'missing'),
            'miterLimit': meta.get('miterLimit', 'missing')
        }
    
    # Validate ring_roles if present
    if 'ring_roles' in data:
        roles = data['ring_roles']
        results['ring_roles'] = {
            'count': len(roles),
            'values': roles[:5] if len(roles) > 5 else roles  # Show first 5
        }
    
    # Validate data consistency
    if 'flat_pts' in data and 'ring_counts' in data:
        total_pts = sum(data['ring_counts']) if data['ring_counts'] else 0
        actual_pts = len(data['flat_pts'])
        results['checks']['pts_count_match'] = (total_pts == actual_pts)
        results['point_stats'] = {
            'total_points': actual_pts,
            'ring_count': len(data['ring_counts']) if data['ring_counts'] else 0,
            'expected_points': total_pts
        }
    
    return results

def validate_gltf_export(gltf_path):
    """Validate glTF export file structure"""
    with open(gltf_path, 'r') as f:
        data = json.load(f)
    
    results = {
        'file': gltf_path.name,
        'valid': True,
        'checks': {}
    }
    
    # Check glTF required fields
    required = ['asset', 'buffers', 'bufferViews', 'accessors']
    for field in required:
        results['checks'][field] = field in data
        if not results['checks'][field]:
            results['valid'] = False
    
    # Check binary file exists
    bin_path = gltf_path.with_suffix('.bin')
    results['checks']['binary_exists'] = bin_path.exists()
    if bin_path.exists():
        results['binary_size'] = bin_path.stat().st_size
    
    # Get mesh statistics
    if 'meshes' in data and data['meshes']:
        mesh = data['meshes'][0]
        if 'primitives' in mesh and mesh['primitives']:
            prim = mesh['primitives'][0]
            results['mesh_stats'] = {
                'has_positions': 'POSITION' in prim.get('attributes', {}),
                'has_indices': 'indices' in prim,
                'mode': prim.get('mode', 4)  # 4 = TRIANGLES
            }
    
    return results

def validate_export_directory(export_dir):
    """Validate complete export directory"""
    export_path = Path(export_dir)
    
    if not export_path.exists():
        return {'error': f'Directory {export_dir} does not exist'}
    
    report = {
        'directory': str(export_path),
        'json_files': [],
        'gltf_files': [],
        'summary': {}
    }
    
    # Find and validate JSON files
    for json_file in export_path.glob('group_*.json'):
        result = validate_json_export(json_file)
        report['json_files'].append(result)
    
    # Find and validate glTF files
    for gltf_file in export_path.glob('mesh_group_*.gltf'):
        result = validate_gltf_export(gltf_file)
        report['gltf_files'].append(result)
    
    # Generate summary
    report['summary'] = {
        'total_json': len(report['json_files']),
        'total_gltf': len(report['gltf_files']),
        'all_json_valid': all(f['valid'] for f in report['json_files']),
        'all_gltf_valid': all(f['valid'] for f in report['gltf_files']),
        'has_meta': any(f['checks'].get('has_meta', False) for f in report['json_files']),
        'has_ring_roles': any(f['checks'].get('has_ring_roles', False) for f in report['json_files'])
    }
    
    return report

def print_report(report):
    """Print validation report"""
    print("="*60)
    print("EXPORT VALIDATION REPORT")
    print("="*60)
    print(f"\nDirectory: {report['directory']}")
    print(f"JSON Files: {report['summary']['total_json']}")
    print(f"glTF Files: {report['summary']['total_gltf']}")
    
    print("\n--- JSON Files ---")
    for f in report['json_files']:
        print(f"\n{f['file']}:")
        print(f"  Valid: {'✅' if f['valid'] else '❌'}")
        for check, result in f['checks'].items():
            print(f"  {check}: {'✅' if result else '❌'}")
        if 'meta' in f:
            print(f"  Meta: {f['meta']}")
        if 'ring_roles' in f:
            print(f"  Ring roles: {f['ring_roles']['count']} roles")
        if 'point_stats' in f:
            print(f"  Points: {f['point_stats']['total_points']} in {f['point_stats']['ring_count']} rings")
    
    print("\n--- glTF Files ---")
    for f in report['gltf_files']:
        print(f"\n{f['file']}:")
        print(f"  Valid: {'✅' if f['valid'] else '❌'}")
        for check, result in f['checks'].items():
            print(f"  {check}: {'✅' if result else '❌'}")
        if 'binary_size' in f:
            print(f"  Binary size: {f['binary_size']} bytes")
        if 'mesh_stats' in f:
            print(f"  Mesh: {f['mesh_stats']}")
    
    print("\n--- Summary ---")
    print(f"All JSON valid: {'✅' if report['summary']['all_json_valid'] else '❌'}")
    print(f"All glTF valid: {'✅' if report['summary']['all_gltf_valid'] else '❌'}")
    print(f"Has meta fields: {'✅' if report['summary']['has_meta'] else '❌'}")
    print(f"Has ring_roles: {'✅' if report['summary']['has_ring_roles'] else '❌'}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_export_validation.py <export_directory>")
        sys.exit(1)
    
    report = validate_export_directory(sys.argv[1])
    
    if 'error' in report:
        print(f"Error: {report['error']}")
        sys.exit(1)
    
    print_report(report)
    
    # Save report as JSON
    report_file = Path(sys.argv[1]) / 'validation_report.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_file}")