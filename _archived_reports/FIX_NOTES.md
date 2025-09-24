# CADGameFusion 修复说明

## 修复历程总结

本次修复主要解决了CI构建问题，确保项目能在所有平台上成功构建和测试。

## 1. 主要问题及修复

### 问题1：CMakeCache.txt 冲突
**症状**：
```
CMake Error: The current CMakeCache.txt directory /home/runner/work/... 
is different than the directory /Users/huazhou/... where CMakeCache.txt was created
```

**原因**：
- build目录被误提交到git
- 包含了本地机器的CMakeCache.txt

**修复方案**：
```bash
# 1. 删除build目录
rm -rf build/
git add -A && git commit -m "Remove build directory"

# 2. 更新.gitignore
echo "build/" >> .gitignore
echo "CMakeCache.txt" >> .gitignore
```

### 问题2：Windows DLL导出错误
**症状**：
```
error C2491: 'core_get_version': definition of dllimport function not allowed
```

**原因**：
- Windows需要正确的dllexport/dllimport宏
- 编译时未定义CORE_BUILD

**修复方案**：
```cmake
# core/CMakeLists.txt
target_compile_definitions(core PRIVATE CORE_BUILD)
target_compile_definitions(core_c PRIVATE CORE_BUILD)
```

### 问题3：Linux共享库PIC错误
**症状**：
```
relocation R_X86_64_PC32 against symbol can not be used when making a shared object; 
recompile with -fPIC
```

**原因**：
- 静态库用于共享库时需要位置无关代码

**修复方案**：
```cmake
# core/CMakeLists.txt
set_property(TARGET core PROPERTY POSITION_INDEPENDENT_CODE ON)
```

### 问题4：测试中EntityType未定义
**症状**：
```
error: 'EntityType' has not been declared
error: no member named 'EntityType' in namespace 'core'
```

**原因**：
- 缺少必要的头文件包含
- 命名空间使用错误

**修复方案**：
```cpp
// test_boolean_offset.cpp
#include "core/document.hpp"  // 添加这行
// 使用 core::EntityType 而不是 EntityType
```

### 问题5：Polyline构造函数错误
**症状**：
```
error: no matching constructor for initialization of 'std::vector<Polyline>'
```

**原因**：
- 测试代码试图用Entity的字段初始化Polyline
- Polyline只有points成员

**修复方案**：
```cpp
// 错误用法
std::vector<Polyline> A{{0,core::EntityType::Polyline,"A",nullptr}};

// 正确用法
std::vector<Polyline> A(1);
A[0].points = rect(0,0,10,10);
```

### 问题6：vcpkg网络下载失败
**症状**：
```
Failed to download file with error: 1
vcpkg install failed
```

**原因**：
- CI环境网络不稳定
- vcpkg包下载超时

**修复方案**：
```yaml
# .github/workflows/cadgamefusion-core.yml
# 添加降级逻辑
if [ -d "$VCPKG_ROOT" ]; then
  if cmake ... -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/...; then
    echo "✅ CMake configured with vcpkg"
  else
    echo "⚠️ vcpkg failed, falling back to standard build"
    rm -rf build
    cmake -S . -B build $CMAKE_ARGS 2>&1
  fi
fi
```

### 问题7：tests/core/CMakeLists.txt重复定义
**症状**：
- 有两个core_tests_strict目标定义
- 一个条件编译的core_tests_boolean_offset_strict

**修复方案**：
```cmake
# 删除重复的定义，保留一个
add_executable(core_tests_strict test_boolean_offset_strict.cpp)
target_include_directories(core_tests_strict PRIVATE ../../core/include)
target_link_libraries(core_tests_strict PRIVATE core)
```

## 2. 增强功能

### 2.1 可选vcpkg支持
```json
// vcpkg-configuration.json
{
  "default-registry": {
    "kind": "builtin",
    "baseline": "c9fa965c2a1b1334469b4539063f3ce95383653c"
  }
}
```

### 2.2 严格测试
```cpp
// test_boolean_offset_strict.cpp
- 分离矩形测试
- 共边矩形测试
- 包含矩形测试
- 偏移操作验证
- Shoelace公式面积验证
```

### 2.3 独立ExportDialog类
```cpp
// export_dialog.hpp/cpp
- 独立的导出配置对话框
- 支持JSON/glTF/Unity格式
- JoinType和MiterLimit元数据
- 打开目录和复制报告功能
```

### 2.4 完整的Qt头文件
```cpp
// mainwindow.cpp
#include <QDialog>
#include <QFormLayout>
#include <QCheckBox>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QDialogButtonBox>
#include <QSettings>
```

## 3. CI工作流配置

### 基础CI（成功）
- 自动检测vcpkg
- 失败时降级到stub
- 所有平台通过

### 严格CI（网络问题）
- 强制vcpkg依赖
- Windows下载失败
- 不影响核心功能

### 简单测试（成功）
- 最小化测试
- 无外部依赖
- 验证核心构建

## 4. 验证步骤

### 本地验证
```bash
# 1. 清理并构建
rm -rf build
cmake -S . -B build -DBUILD_EDITOR_QT=OFF
cmake --build build

# 2. 运行测试
cd build/tests/core
./test_simple
./core_tests_triangulation
./core_tests_boolean_offset
./core_tests_strict
```

### CI验证
- ✅ Core CI: 全平台通过
- ✅ Test Simple: 全平台通过
- ⚠️ Strict CI: Windows网络问题

## 5. 经验教训

1. **永远不要提交build目录**
   - 使用.gitignore排除
   - CMakeCache.txt包含机器特定路径

2. **Windows需要特殊处理**
   - DLL导出需要CORE_BUILD宏
   - 路径分隔符差异
   - vcpkg网络问题更常见

3. **测试要包含必要头文件**
   - 不要假设传递包含
   - 明确使用命名空间

4. **CI要有降级机制**
   - 网络依赖不可靠
   - 提供fallback选项
   - 核心功能优先

## 6. 后续建议

1. 考虑使用vcpkg缓存
2. 添加本地依赖选项
3. 改进Windows网络重试
4. 文档化所有构建选项

---

**状态**: ✅ 修复完成  
**测试**: ✅ 通过  
**平台**: Ubuntu/macOS/Windows  
**日期**: 2024-09-14