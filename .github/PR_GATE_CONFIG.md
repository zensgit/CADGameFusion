# PR Gate Configuration

## Required Status Checks

The following GitHub Actions workflows must pass before merging PRs to `main`:

### Core Strict - Exports, Validation, Comparison
- **Workflow**: `.github/workflows/strict-exports.yml`
- **Job**: `exports-validate-compare`
- **Required for**: All PRs to `main` branch

## Branch Protection Rules

Configure in GitHub Settings > Branches > main:

1. **Require status checks to pass before merging** ✓
2. **Require branches to be up to date before merging** ✓
3. **Status checks that are required**:
   - `exports-validate-compare`

## Three-Tier Validation System

The strict-exports workflow implements three levels of validation:

### 1. Structure Comparison (Strong Selected)
- Validates export directory structure matches reference samples
- Required scenes: sample, holes, complex, scene_complex_spec, scene_concave_spec, scene_nested_holes_spec
- Zero tolerance for structural differences in critical scenes

### 2. Schema Validation  
- Validates JSON exports against `docs/schemas/cli_spec.schema.json`
- Validates spec files in `tools/specs/*_spec.json`
- Uses jsonschema Python library for strict validation

### 3. Field-Level Comparison (Strict)
- Numerical field comparison with configurable tolerance
- Default rtol: 1e-6 (Linux/macOS), 1e-5 (Windows)
- Includes metadata comparison with normalize tracking
- Supports GLTF mismatch allowance for specific scenes

## Metadata Normalization Recording

All exported JSON files include normalization status in meta section:

```json
{
  "meta": {
    "normalize": {
      "orientation": true,
      "start": true, 
      "sortRings": true
    }
  }
}
```

This enables tracking of polygon processing operations for comparison and debugging.