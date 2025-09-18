# CADGameFusion Development Shortcuts

## Quick Commands

### Local CI & Validation
```bash
# Full strict validation (recommended before PR)
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full

# Quick verification check (after CI run)
bash scripts/check_verification.sh --root build

# Refresh golden samples (when export logic changes)
bash tools/refresh_golden_samples.sh
```

### Build & Test
```bash
# Debug build
cmake -B build -DCMAKE_BUILD_TYPE=Debug -DCADGF_USE_NLOHMANN_JSON=ON
cmake --build build

# Release build with ring sorting
cmake -B build -DCMAKE_BUILD_TYPE=Release -DCADGF_SORT_RINGS=ON -DCADGF_USE_NLOHMANN_JSON=ON
cmake --build build

# Run tests
cd build && ctest --output-on-failure
```

### Export CLI
```bash
# Basic export (sample scene)
./build/tools/export_cli --out exports --scene sample

# Full topology export (with holes)
./build/tools/export_cli --out exports --scene complex --gltf-holes full

# Spec mode with normalization
./build/tools/export_cli --out exports --scene complex_spec --spec --normalize
```

### Git Workflows
```bash
# Create session branch
git checkout -b session/feature-name

# Quick commit with Claude attribution
git commit -m "feat: description

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push and create PR
git push -u origin session/feature-name
gh pr create --title "Title" --body "Description"
```

### Branch Protection & Release
```bash
# Check branch protection status
gh api repos/zensgit/CADGameFusion/branches/main/protection

# Create release
gh release create v0.x.y --title "Title" --notes "Release notes"

# List recent issues/PRs
gh issue list --limit 5
gh pr list --state merged --limit 5
```

## Pre-Push Checklist

- [ ] Local strict CI passed: `bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- [ ] Quick verification check: `bash scripts/check_verification.sh --root build`
- [ ] No failing field_*.json files: all show `"status": "passed"`
- [ ] Consistency stats match baseline (no unexpected count changes)
- [ ] No unintended binary files in commit
- [ ] Commit message follows convention with Claude attribution

### Pre-Push Hook Setup
```bash
# Set up automatic pre-push validation (optional)
echo '#!/bin/bash
if [ -d "build" ]; then
  echo "Running pre-push verification..."
  bash scripts/check_verification.sh --root build
  if [ $? -ne 0 ]; then
    echo "Pre-push verification failed. Run local CI first:"
    echo "bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full"
    exit 1
  fi
fi' > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## File Patterns

### Important Paths
- `tools/export_cli.cpp` - Core export logic
- `editor/qt/src/export_dialog.cpp` - Qt export UI  
- `tools/local_ci.sh` - Local validation script
- `sample_exports/` - Golden reference samples
- `.github/workflows/` - CI configurations

### Generated Files (Do Not Commit)
- `build/` - Build artifacts
- `field_*.json` - Validation output files
- `consistency_stats.txt` - Runtime statistics
- Temporary export directories

## Common Debugging

### CI Failures
```bash
# Check recent workflow runs
gh run list --limit 5

# View specific failure
gh run view --job=<job-id>

# Download CI artifacts
gh run download <run-id>
```

### Validation Issues
```bash
# Check field validation details
find build -name "field_*.json" -exec echo "=== {} ===" \; -exec cat {} \;

# Compare consistency stats
cat build/consistency_stats.txt
cat sample_exports/scene_*/consistency_stats.txt
```

### Export Format Issues
```bash
# Validate JSON schema
python tools/validate_schema.py --scene-dir build/exports/scene_name

# Check glTF structure
file build/exports/scene_name/*.gltf
ls -la build/exports/scene_name/*.bin
```

## Release Process

1. **Development**
   - Work in session branch: `git checkout -b session/feature-name`
   - Run local CI before each push
   - Create PR with proper template

2. **Pre-Release**
   - All CI checks green
   - Documentation updated
   - Baseline tag created if needed

3. **Release**
   - Create GitHub release with changelog
   - Update version references
   - Create follow-up issues for next milestones

## Baseline Management

- **Current Baseline**: `ci-baseline-2025-09-18`
- **Golden Refresh**: Only when export logic semantically changes
- **Rollback**: `git checkout ci-baseline-2025-09-18` + re-run strict CI

## Recent Issues & Roadmap

### Active Development Issues
- **Issue #10**: Add C++ unit test for meta.normalize emission (Medium priority)
- **Issue #11**: Deterministic ring ordering validation with CADGF_SORT_RINGS=ON (Low priority)  
- **Issue #12**: Research multi-mesh/material metadata for v0.3.0 (Low priority, planning)

### Quick Issue Commands
```bash
# View recent issues
gh issue list --limit 5

# Create new issue with template
gh issue create --title "feat/fix/chore: description" --body "Details..."

# Link to PR
gh pr create --title "Title" --body "Fixes #issue-number"
```

### Version Milestones
- **v0.2.0** ✅: Qt export enhancements + strict validation baseline
- **v0.2.1** 📋: Testing improvements (Issues #10, #11)
- **v0.3.0** 🔮: Multi-mesh/material metadata expansion (Issue #12)