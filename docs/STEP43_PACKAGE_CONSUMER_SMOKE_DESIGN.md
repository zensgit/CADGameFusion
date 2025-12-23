# Step 43: CMake Package Consumer Smoke Test - Design

## Goal
- Validate the installed CADGameFusion package can be consumed via `find_package`.
- Confirm `cadgf::core_c` is linkable in an external CMake project.

## Changes
1. Add a minimal CMake consumer project under `tests/package_consumer`.
2. Add a CMake script to install the build and configure/build the consumer.
3. Register a CTest smoke test that drives the consumer build.

## Files
- `tests/package_consumer/CMakeLists.txt`
- `tests/package_consumer/main.c`
- `cmake/RunPackageConsumer.cmake`
- `CMakeLists.txt`
