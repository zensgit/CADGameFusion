#!/bin/bash

# CADGameFusion Development Environment Verification Script
# Checks for required tools and provides setup guidance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 CADGameFusion Development Environment Verification"
echo "=================================================="
echo "Project root: $PROJECT_ROOT"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SUCCESS_COUNT=0
FAILURE_COUNT=0
WARNING_COUNT=0

# Function to check if command exists
check_command() {
    local cmd="$1"
    local required="$2"
    local version_flag="$3"
    local min_version="$4"
    
    printf "%-20s" "$cmd:"
    
    if command -v "$cmd" >/dev/null 2>&1; then
        local version_output=""
        if [ -n "$version_flag" ]; then
            version_output=$($cmd $version_flag 2>&1 | head -1 || echo "unknown")
        fi
        
        if [ "$required" = "required" ]; then
            echo -e "${GREEN}✓ Found${NC} ${version_output}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${BLUE}✓ Available${NC} ${version_output}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
    else
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗ Missing${NC}"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        else
            echo -e "${YELLOW}⚠ Missing (optional)${NC}"
            WARNING_COUNT=$((WARNING_COUNT + 1))
        fi
    fi
}

# Function to check for file existence
check_file() {
    local file_path="$1"
    local description="$2"
    local required="$3"
    
    printf "%-20s" "$description:"
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✓ Found${NC} ($file_path)"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗ Missing${NC} ($file_path)"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        else
            echo -e "${YELLOW}⚠ Missing (optional)${NC} ($file_path)"
            WARNING_COUNT=$((WARNING_COUNT + 1))
        fi
    fi
}

echo "🔧 Core Build Tools"
echo "==================="
check_command "git" "required" "--version"
check_command "cmake" "required" "--version"
check_command "make" "optional" "--version"
check_command "ninja" "optional" "--version"

echo ""
echo "📚 C++ Compiler"
echo "==============="
check_command "gcc" "optional" "--version"
check_command "g++" "optional" "--version"
check_command "clang" "optional" "--version"
check_command "clang++" "optional" "--version"

# Platform-specific checks
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo ""
    echo "🪟 Windows-specific"
    echo "=================="
    check_command "cl" "optional" ""
    check_command "msbuild" "optional" "-version"
fi

echo ""
echo "🐍 Python Environment"
echo "===================="
check_command "python3" "required" "--version"
check_command "pip3" "required" "--version"

# Check Python packages
echo ""
echo "📦 Python Dependencies"
echo "======================"
printf "%-20s" "jsonschema:"
if python3 -c "import jsonschema" 2>/dev/null; then
    version=$(python3 -c "import jsonschema; print(jsonschema.__version__)" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Available${NC} (v$version)"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${YELLOW}⚠ Missing (install: pip3 install jsonschema)${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi

printf "%-20s" "numpy:"
if python3 -c "import numpy" 2>/dev/null; then
    version=$(python3 -c "import numpy; print(numpy.__version__)" 2>/dev/null || echo "unknown")
    echo -e "${BLUE}✓ Available${NC} (v$version)"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    echo -e "${YELLOW}⚠ Missing (optional, install: pip3 install numpy)${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi

echo ""
echo "🏗️ Project Structure"
echo "===================="
check_file "$PROJECT_ROOT/CMakeLists.txt" "CMakeLists.txt" "required"
check_file "$PROJECT_ROOT/vcpkg.json" "vcpkg.json" "required"
check_file "$PROJECT_ROOT/core/CMakeLists.txt" "core/CMakeLists.txt" "required"
check_file "$PROJECT_ROOT/tools/export_cli.cpp" "export_cli.cpp" "required"

echo ""
echo "🔄 Development Scripts"  
echo "======================"
check_file "$PROJECT_ROOT/scripts/bootstrap_vcpkg.sh" "bootstrap_vcpkg.sh" "required"
check_file "$PROJECT_ROOT/scripts/build_core.sh" "build_core.sh" "required"
check_file "$PROJECT_ROOT/tools/local_ci.sh" "local_ci.sh" "required"
check_file "$PROJECT_ROOT/scripts/check_verification.sh" "check_verification.sh" "required"

echo ""
echo "🧪 Validation Tools"
echo "==================="
check_file "$PROJECT_ROOT/tools/validate_export.py" "validate_export.py" "required"
check_file "$PROJECT_ROOT/tools/compare_fields.py" "compare_fields.py" "required"
check_file "$PROJECT_ROOT/tools/test_normalization.py" "test_normalization.py" "required"

echo ""
echo "📋 Configuration Files"
echo "======================"
check_file "$PROJECT_ROOT/requirements-ci.txt" "requirements-ci.txt" "optional"
check_file "$PROJECT_ROOT/.github/workflows/strict-exports.yml" "strict-exports.yml" "required"

echo ""
echo "🔍 VCPKG Environment"
echo "===================="
if [ -n "${VCPKG_ROOT:-}" ]; then
    printf "%-20s" "VCPKG_ROOT:"
    if [ -d "$VCPKG_ROOT" ]; then
        echo -e "${GREEN}✓ Set${NC} ($VCPKG_ROOT)"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        
        printf "%-20s" "vcpkg executable:"
        if [ -f "$VCPKG_ROOT/vcpkg" ] || [ -f "$VCPKG_ROOT/vcpkg.exe" ]; then
            echo -e "${GREEN}✓ Found${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo -e "${YELLOW}⚠ Missing (run: $VCPKG_ROOT/bootstrap-vcpkg.sh)${NC}"
            WARNING_COUNT=$((WARNING_COUNT + 1))
        fi
    else
        echo -e "${YELLOW}⚠ Set but directory missing${NC}"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
else
    echo -e "${YELLOW}⚠ VCPKG_ROOT not set (optional for full features)${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi

echo ""
echo "📊 Summary"
echo "=========="
echo -e "✅ Success: ${GREEN}$SUCCESS_COUNT${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNING_COUNT${NC}"
echo -e "❌ Failures: ${RED}$FAILURE_COUNT${NC}"

echo ""
if [ $FAILURE_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 Environment check passed!${NC}"
    if [ $WARNING_COUNT -gt 0 ]; then
        echo -e "${YELLOW}Note: Some optional components are missing but the core development environment is ready.${NC}"
    fi
    echo ""
    echo "💡 Next steps:"
    echo "   1. Run: bash scripts/bootstrap_vcpkg.sh"
    echo "   2. Run: bash scripts/build_core.sh"
    echo "   3. Run: bash tools/local_ci.sh --build-type Release"
else
    echo -e "${RED}❌ Environment check failed!${NC}"
    echo ""
    echo "🔧 Required fixes:"
    echo "   - Install missing required tools (marked with ✗)"
    echo "   - Run: bash scripts/bootstrap_vcpkg.sh (for VCPKG setup)"
    echo "   - Install Python dependencies: pip3 install -r requirements-ci.txt"
    echo ""
    echo "📖 See docs/Build-From-Source.md for detailed setup instructions"
    exit 1
fi

echo ""
echo "📚 Useful commands after setup:"
echo "   bash tools/local_ci.sh --build-type Release --gltf-holes full"
echo "   bash scripts/check_verification.sh --root build --verbose"
echo "   python3 tools/validate_export.py build/exports/scene_cli_sample"
echo ""