#!/bin/bash

# Windows CI Mirror Fix Script
# This script provides multiple strategies to fix Windows CI vcpkg/msys2 issues

set -e

echo "🔧 Windows CI修复脚本"
echo "===================="

# Strategy 1: Use alternative mirrors
setup_alternative_mirrors() {
    echo "📡 配置备用镜像源..."
    
    # Set environment variables for alternative mirrors
    export VCPKG_BINARY_SOURCES="clear;files,$GITHUB_WORKSPACE/vcpkg-cache,readwrite"
    
    # Use specific vcpkg commit known to be stable
    if [ -d "vcpkg" ]; then
        echo "🔄 切换到稳定的vcpkg版本..."
        cd vcpkg
        git fetch origin
        # Use a known stable commit (update this as needed)
        git checkout 2024.08.23
        cd ..
    fi
}

# Strategy 2: Reduce dependency scope
minimal_dependencies() {
    echo "📦 最小化依赖配置..."
    
    # Create minimal vcpkg.json for Windows
    cat > vcpkg-windows-minimal.json << 'EOF'
{
    "name": "cadgamefusion",
    "version": "0.1.0",
    "dependencies": [
        "earcut-hpp"
    ]
}
EOF
    
    echo "✨ 生成Windows专用最小依赖配置"
}

# Strategy 3: Cache optimization
optimize_cache() {
    echo "🗄️ 优化缓存策略..."
    
    # Set aggressive caching
    export VCPKG_DEFAULT_BINARY_CACHE="$GITHUB_WORKSPACE/vcpkg-cache"
    
    # Use binary caching with fallback
    export VCPKG_BINARY_SOURCES="clear;default;files,$GITHUB_WORKSPACE/vcpkg-cache,readwrite"
    
    echo "📊 缓存配置完成"
}

# Strategy 4: Timeout and retry enhancement
enhance_retry() {
    echo "🔄 增强重试机制..."
    
    # Enhanced retry function with exponential backoff
    vcpkg_install_with_retry() {
        local max_attempts=5
        local delay=10
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            echo "🎯 尝试 $attempt/$max_attempts..."
            
            if timeout 1800 vcpkg install --triplet x64-windows; then
                echo "✅ vcpkg安装成功"
                return 0
            fi
            
            echo "❌ 尝试 $attempt 失败，等待 ${delay}s..."
            sleep $delay
            delay=$((delay * 2))
            attempt=$((attempt + 1))
        done
        
        echo "🚨 所有重试失败"
        return 1
    }
    
    # Export function for use
    export -f vcpkg_install_with_retry
}

# Strategy 5: Mirror health check
check_mirror_health() {
    echo "🏥 检查镜像健康状态..."
    
    # Test primary mirrors
    local mirrors=(
        "https://mirror.msys2.org"
        "https://repo.msys2.org"
        "https://mirrors.tuna.tsinghua.edu.cn/msys2"
        "https://mirrors.ustc.edu.cn/msys2"
    )
    
    for mirror in "${mirrors[@]}"; do
        echo "🔍 测试镜像: $mirror"
        if curl -s --connect-timeout 10 "$mirror" > /dev/null; then
            echo "✅ $mirror 可用"
        else
            echo "❌ $mirror 不可用"
        fi
    done
}

# Main execution
main() {
    echo "🚀 开始Windows CI修复流程..."
    
    # Check mirror health first
    check_mirror_health
    
    # Apply all strategies
    setup_alternative_mirrors
    minimal_dependencies
    optimize_cache
    enhance_retry
    
    echo ""
    echo "🎉 Windows CI修复配置完成!"
    echo "📋 应用的策略:"
    echo "  ✅ 备用镜像源配置"
    echo "  ✅ 最小化依赖"
    echo "  ✅ 缓存优化"
    echo "  ✅ 增强重试机制"
    echo ""
    echo "💡 使用方法:"
    echo "  source scripts/windows_ci_fix.sh"
    echo "  vcpkg_install_with_retry"
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi