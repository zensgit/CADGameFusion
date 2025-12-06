#!/bin/bash
# vcpkg Cache Test Script
# Tests vcpkg binary caching locally

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== vcpkg Binary Cache Test ==="
echo ""

# Setup cache directory
export VCPKG_DEFAULT_BINARY_CACHE="${HOME}/.cache/vcpkg/archives"
mkdir -p "$VCPKG_DEFAULT_BINARY_CACHE"

# Configure binary sources (local file cache + GitHub Actions cache)
export VCPKG_BINARY_SOURCES="clear;files,$VCPKG_DEFAULT_BINARY_CACHE,readwrite"
export VCPKG_FEATURE_FLAGS="manifests,binarycaching"

echo "Configuration:"
echo "  Cache directory: $VCPKG_DEFAULT_BINARY_CACHE"
echo "  Binary sources: $VCPKG_BINARY_SOURCES"
echo "  Feature flags: $VCPKG_FEATURE_FLAGS"
echo ""

# Check initial cache state
INITIAL_FILES=$(find "$VCPKG_DEFAULT_BINARY_CACHE" -type f 2>/dev/null | wc -l || echo 0)
INITIAL_SIZE=$(du -sh "$VCPKG_DEFAULT_BINARY_CACHE" 2>/dev/null | cut -f1 || echo "0")

echo "Initial cache state:"
echo "  Files: $INITIAL_FILES"
echo "  Size: $INITIAL_SIZE"
echo ""

# Check if vcpkg is available
if [ -d "vcpkg" ]; then
    VCPKG_ROOT="$(pwd)/vcpkg"
else
    echo -e "${YELLOW}vcpkg not found. Please run from repository root.${NC}"
    exit 1
fi

# Clean build directory for fresh test
if [ -d "build_cache_test" ]; then
    rm -rf build_cache_test
fi

echo "=== First Build (Cold Cache) ==="
START_TIME=$(date +%s)

# First build - should populate cache
cmake -S . -B build_cache_test \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_MANIFEST_MODE=ON \
    -DVCPKG_TARGET_TRIPLET=x64-linux \
    -DVCPKG_INSTALLED_DIR=vcpkg/installed \
    -DBUILD_EDITOR_QT=OFF \
    -G Ninja 2>&1 | tee build_cache_test/configure_1.log

# Extract cache statistics
echo ""
echo "Analyzing first build..."
if grep -q "restored from cache" build_cache_test/configure_1.log; then
    RESTORED_1=$(grep -c "restored from cache" build_cache_test/configure_1.log || echo 0)
    echo -e "${GREEN}Restored from cache: $RESTORED_1${NC}"
fi

if grep -q "Installing" build_cache_test/configure_1.log; then
    INSTALLED_1=$(grep -c "Installing" build_cache_test/configure_1.log || echo 0)
    echo -e "${YELLOW}Installed fresh: $INSTALLED_1${NC}"
fi

END_TIME=$(date +%s)
DURATION_1=$((END_TIME - START_TIME))
echo "Duration: ${DURATION_1}s"

# Check cache after first build
AFTER_1_FILES=$(find "$VCPKG_DEFAULT_BINARY_CACHE" -type f 2>/dev/null | wc -l || echo 0)
AFTER_1_SIZE=$(du -sh "$VCPKG_DEFAULT_BINARY_CACHE" 2>/dev/null | cut -f1 || echo "0")

echo ""
echo "Cache after first build:"
echo "  Files: $AFTER_1_FILES (added: $((AFTER_1_FILES - INITIAL_FILES)))"
echo "  Size: $AFTER_1_SIZE"

# Clean installed directory but keep cache
echo ""
echo "=== Cleaning installed packages (keeping cache) ==="
rm -rf vcpkg/installed
rm -rf build_cache_test

echo ""
echo "=== Second Build (Warm Cache) ==="
START_TIME=$(date +%s)

# Second build - should use cache
cmake -S . -B build_cache_test \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_MANIFEST_MODE=ON \
    -DVCPKG_TARGET_TRIPLET=x64-linux \
    -DVCPKG_INSTALLED_DIR=vcpkg/installed \
    -DBUILD_EDITOR_QT=OFF \
    -G Ninja 2>&1 | tee build_cache_test/configure_2.log

# Extract cache statistics
echo ""
echo "Analyzing second build..."
if grep -q "restored from cache" build_cache_test/configure_2.log; then
    RESTORED_2=$(grep -c "restored from cache" build_cache_test/configure_2.log || echo 0)
    echo -e "${GREEN}Restored from cache: $RESTORED_2${NC}"
fi

if grep -q "Installing" build_cache_test/configure_2.log; then
    INSTALLED_2=$(grep -c "Installing" build_cache_test/configure_2.log || echo 0)
    echo -e "${YELLOW}Installed fresh: $INSTALLED_2${NC}"
fi

END_TIME=$(date +%s)
DURATION_2=$((END_TIME - START_TIME))
echo "Duration: ${DURATION_2}s"

# Calculate cache effectiveness
echo ""
echo "=== Cache Effectiveness Summary ==="

if [ "$AFTER_1_FILES" -gt "$INITIAL_FILES" ]; then
    echo -e "${GREEN}✓ Cache populated: $((AFTER_1_FILES - INITIAL_FILES)) new files${NC}"
else
    echo -e "${RED}✗ No cache files created${NC}"
fi

if [ "$DURATION_2" -lt "$DURATION_1" ]; then
    SPEEDUP=$(echo "scale=1; ($DURATION_1 - $DURATION_2) * 100 / $DURATION_1" | bc -l)
    echo -e "${GREEN}✓ Second build faster: ${SPEEDUP}% speedup${NC}"
else
    echo -e "${YELLOW}⚠ No speedup detected${NC}"
fi

# Calculate hit rate
TOTAL_PACKAGES=$((RESTORED_2 + INSTALLED_2))
if [ "$TOTAL_PACKAGES" -gt 0 ]; then
    HIT_RATE=$(echo "scale=1; $RESTORED_2 * 100 / $TOTAL_PACKAGES" | bc -l)
    echo "Cache hit rate: ${HIT_RATE}%"

    if (( $(echo "$HIT_RATE > 80" | bc -l) )); then
        echo -e "${GREEN}✓ Cache hit rate above target (>80%)${NC}"
    else
        echo -e "${YELLOW}⚠ Cache hit rate below target (<80%)${NC}"
    fi
fi

echo ""
echo "Build times:"
echo "  First build:  ${DURATION_1}s"
echo "  Second build: ${DURATION_2}s"

# Clean up test directory
rm -rf build_cache_test

echo ""
echo "=== Test Complete ==="