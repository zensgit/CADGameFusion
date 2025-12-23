# Step 41: Package Version Config - Design

## Goal
- Add a project version for CADGameFusion CMake.
- Generate and install `CADGameFusionConfigVersion.cmake`.

## Changes
1. Set `project(CADGameFusion VERSION ...)`.
2. Generate version config via `write_basic_package_version_file`.
3. Install the version config alongside the package config.

## Files
- `CMakeLists.txt`
