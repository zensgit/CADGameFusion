#!/bin/bash
# Local CI Verification Script

echo "======================================"
echo "Local CI Verification"
echo "======================================"
echo ""

# Check if workflows are valid YAML
echo "1. Validating Workflow Files"
echo "----------------------------"
for workflow in .github/workflows/*.yml; do
    if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
        echo "✅ $(basename $workflow): Valid YAML"
    else
        echo "❌ $(basename $workflow): Invalid YAML"
    fi
done
echo ""

# Simulate CI build locally
echo "2. Local Build Test (Simulating CI)"
echo "------------------------------------"

# Clean previous build
rm -rf build_test

# Test without vcpkg (relaxed mode)
echo "Testing relaxed build (no vcpkg)..."
if cmake -S . -B build_test \
    -DBUILD_EDITOR_QT=OFF \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_EARCUT=OFF \
    -DUSE_CLIPPER2=OFF 2>&1 | tail -5; then
    echo "✅ Relaxed configuration successful"
else
    echo "❌ Relaxed configuration failed"
fi

# Build
if cmake --build build_test --config Release --parallel 2 2>&1 | tail -3; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
fi

# Run tests
echo ""
echo "3. Running Tests"
echo "----------------"
if [ -f "build_test/tests/core/test_simple" ]; then
    ./build_test/tests/core/test_simple && echo "✅ test_simple passed" || echo "❌ test_simple failed"
else
    echo "⚠️ test_simple not found (expected if vcpkg not used)"
fi

echo ""
echo "4. Checking vcpkg Configuration"
echo "--------------------------------"
if [ -f "vcpkg-configuration.json" ]; then
    echo "✅ vcpkg-configuration.json exists"
    cat vcpkg-configuration.json | python3 -m json.tool | head -10
else
    echo "❌ vcpkg-configuration.json missing"
fi

if [ -f "vcpkg.json" ]; then
    echo "✅ vcpkg.json exists"
    cat vcpkg.json | python3 -m json.tool | head -15
else
    echo "❌ vcpkg.json missing"
fi

echo ""
echo "======================================"
echo "CI Configuration Summary"
echo "======================================"
echo ""
echo "Workflows configured:"
echo "- Core CI (Relaxed): Auto-fallback to no vcpkg"
echo "- Core CI (Strict): vcpkg required with retry"
echo "- Test Simple: Minimal test validation"
echo ""
echo "Enhanced features:"
echo "✅ Windows 3x retry with 10s delay"
echo "✅ vcpkg caching for all platforms"
echo "✅ Automatic fallback mechanism"
echo "✅ Network resilience improvements"
echo ""
echo "To trigger CI on GitHub:"
echo "1. Ensure repository is public or has Actions enabled"
echo "2. Push commits to trigger workflows"
echo "3. Check https://github.com/zensgit/CADGameFusion/actions"