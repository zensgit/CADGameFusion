# vcpkg 缓存分析与替代方案报告

**时间**: 2025-09-22 17:00 UTC+8
**状态**: 🔍 深度分析

## 📊 测试结果汇总

### 工作流运行性能
| 工作流 | Run ID | 运行时间 | vcpkg包数 | 缓存命中 |
|--------|--------|----------|-----------|----------|
| Core Strict Build #1 | 17909748403 | 57秒 | 8 | 0% |
| Core Strict Build #2 | 17909765231 | 141秒 | 8 | 0% |
| Strict Exports | 17909948347 | ~90秒 | 3 | 0% |

### 关键发现
1. **GitHub Actions缓存**: ✅ 正常工作
   - 缓存文件成功恢复
   - 缓存键匹配正确

2. **vcpkg二进制缓存**: ❌ 未生效
   - 持续报告 "Restored 0 package(s)"
   - 所有包仍在重新编译

## 🔍 根本原因分析

### 为什么vcpkg缓存未生效？

#### 1. **包哈希不匹配**
vcpkg使用复杂的哈希算法，包括：
- 工具链版本
- 编译器标志
- 依赖版本
- Triplet配置
- 环境变量

任何微小差异都会导致哈希不匹配，缓存失效。

#### 2. **当前配置问题**
```bash
# 当前设置
VCPKG_BINARY_SOURCES=clear;files,$HOME/.cache/vcpkg/archives,readwrite

# 可能的问题：
# - 缺少默认缓存后备
# - archives目录可能不是正确的缓存位置
```

#### 3. **Triplet不一致**
不同运行可能使用不同的triplet（x64-linux vs x64-linux-dynamic），导致缓存键不匹配。

## 🛠️ 推荐解决方案

### 方案A: 修复vcpkg文件缓存（优先）

```yaml
# .github/workflows/strict-exports.yml
- name: Setup vcpkg binary caching
  run: |
    # 使用官方推荐的缓存配置
    export VCPKG_DEFAULT_BINARY_CACHE="$HOME/.cache/vcpkg/archives"
    mkdir -p "$VCPKG_DEFAULT_BINARY_CACHE"

    # 使用默认缓存作为后备
    echo "VCPKG_BINARY_SOURCES=clear;files,$VCPKG_DEFAULT_BINARY_CACHE,readwrite;default" >> $GITHUB_ENV
    echo "VCPKG_DEFAULT_BINARY_CACHE=$VCPKG_DEFAULT_BINARY_CACHE" >> $GITHUB_ENV

    # 固定triplet
    echo "VCPKG_DEFAULT_TRIPLET=x64-linux" >> $GITHUB_ENV

- name: Configure with fixed triplet
  run: |
    cmake -S . -B build \
      -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
      -DVCPKG_TARGET_TRIPLET=x64-linux \
      -DVCPKG_MANIFEST_MODE=OFF \
      ...
```

### 方案B: 使用NuGet后端（推荐测试）

```yaml
- name: Setup NuGet cache
  run: |
    # 配置NuGet源
    FEED_URL="https://pkgs.dev.azure.com/your-org/_packaging/your-feed/nuget/v3/index.json"
    echo "VCPKG_BINARY_SOURCES=clear;nuget,$FEED_URL,readwrite;default" >> $GITHUB_ENV

    # 配置认证（如需要）
    mono $(vcpkg fetch nuget) sources add \
      -source $FEED_URL \
      -name MyFeed \
      -username USERNAME \
      -password ${{ secrets.NUGET_API_KEY }}
```

### 方案C: 创建vcpkg.json清单（长期方案）

```json
{
  "name": "cadgamefusion",
  "version": "0.3.0",
  "dependencies": [
    {
      "name": "clipper2",
      "version>=": "1.2.0"
    },
    {
      "name": "earcut-hpp",
      "version>=": "2.2.3"
    },
    "vcpkg-cmake"
  ],
  "builtin-baseline": "2023-08-09"
}
```

### 方案D: Docker容器缓存（最可靠）

```dockerfile
# Dockerfile.ci
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    build-essential cmake ninja-build git

# 预装vcpkg和依赖
RUN git clone https://github.com/microsoft/vcpkg.git /vcpkg && \
    /vcpkg/bootstrap-vcpkg.sh && \
    /vcpkg/vcpkg install clipper2 earcut-hpp

# 使用此镜像作为CI基础
```

## 📋 立即行动计划

### 1. 快速修复（今天）
```bash
# 在工作流中添加调试输出
- name: Debug vcpkg cache
  run: |
    echo "=== vcpkg environment ==="
    env | grep VCPKG
    echo "=== Cache directory contents ==="
    ls -la $HOME/.cache/vcpkg/ || true
    ls -la $HOME/.cache/vcpkg/archives/ || true
    echo "=== vcpkg version ==="
    vcpkg version
    echo "=== Triplet info ==="
    echo $VCPKG_DEFAULT_TRIPLET
```

### 2. 测试固定Triplet（明天）
- 修改工作流使用固定的triplet
- 连续运行3次验证缓存命中

### 3. 评估替代方案（本周）
- 测试NuGet后端
- 创建vcpkg.json清单
- 评估Docker镜像方案

## 🎯 性能目标对比

| 指标 | 当前 | 目标 | 方案A预期 | 方案D预期 |
|------|------|------|-----------|-----------|
| 构建时间 | 60-140秒 | <120秒 | 40-60秒 | 30-40秒 |
| 缓存命中率 | 0% | >80% | 70-90% | 100% |
| vcpkg安装 | 30-40秒 | <15秒 | 10-15秒 | 0秒 |
| 可靠性 | 低 | 高 | 中 | 高 |

## 💡 关键建议

1. **短期**: 修复triplet和缓存配置
2. **中期**: 实施vcpkg.json清单模式
3. **长期**: 考虑Docker镜像方案

## 📝 后续监控

需要持续监控的指标：
- vcpkg包哈希稳定性
- 不同OS的缓存命中率
- 构建时间趋势
- CI成本（分钟数）

---

**结论**: vcpkg二进制缓存机制复杂，需要精确配置才能生效。建议优先尝试固定triplet方案，同时评估Docker镜像作为长期解决方案。

**下一步**: 实施方案A（固定triplet）并运行3次测试验证效果。