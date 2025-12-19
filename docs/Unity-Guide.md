# Unity Integration Guide

This guide explains how to use the native `core_c` library from a Unity project.

## Overview
- Native library: `core_c` (Windows: core_c.dll; macOS: libcore_c.dylib; Linux: libcore_c.so)
- C# bindings: `adapters/unity/CoreBindings.cs`
- Sample scripts and scene: `adapters/unity-sample/Assets/...`

## Setup
1) Build native library
- Use scripts (recommended):
```bash
./scripts/bootstrap_vcpkg.sh
export VCPKG_ROOT="$(pwd)/vcpkg"
./scripts/build_core.sh # produces build/bin/core_c.*
```
2) Create or open a Unity project.
3) Place plugin
- Copy `build/bin/core_c.*` to `YourUnityProject/Assets/Plugins/<Platform>/`
  - Windows: `Assets/Plugins/x86_64/core_c.dll`
  - macOS: `Assets/Plugins/macOS/libcore_c.dylib`
  - Linux: `Assets/Plugins/x86_64/libcore_c.so`
4) Add bindings and samples
- Copy `adapters/unity/CoreBindings.cs` into your Unity project (e.g. `Assets/Scripts/`)
- Optionally copy sample scripts from `adapters/unity-sample/Assets/Scripts/`

## Minimal usage
```csharp
using CADGameFusion.UnityAdapter;

public class Example : UnityEngine.MonoBehaviour {
  void Start() {
    // Create document and add a polyline
    var doc = CoreBindings.CreateDocument();
    var pts = new CoreBindings.Vec2[]{ new(){x=0,y=0}, new(){x=1,y=0}, new(){x=1,y=1}, new(){x=0,y=0} };
    var id = CoreBindings.cadgf_document_add_polyline(doc.Ptr, pts, pts.Length);
    UnityEngine.Debug.Log($"Added polyline id={id}");
    CoreBindings.Destroy(doc);
  }
}
```

## Grouping (optional)
- Use group ids to tag related entities (e.g., export by group).
```csharp
var gid = CoreBindings.cadgf_document_alloc_group_id(doc.Ptr);
CoreBindings.cadgf_document_set_entity_group_id(doc.Ptr, id, gid);
```

## Triangulate to Mesh
- Use helper `CoreBindings.Triangulate(Vec2[])` to get indices, then build a Unity `Mesh`.
- Sample provided: `adapters/unity-sample/Assets/Scripts/TriangulateToMesh.cs`

## Sample scene
- Copy `adapters/unity-sample/Assets/Scenes/Sample.unity` into your project and open it.
- Add `SampleBehaviour` or `TriangulateToMesh` to a GameObject and press Play.

## Troubleshooting
- DllNotFoundException:
  - Ensure library is in the correct `Assets/Plugins/<Platform>/` path and matches Editor/Player architecture.
  - macOS: unsigned dylibs may be blocked by Gatekeeper. Allow in Security settings or codesign for distribution.
- ABI/interop issues:
  - Make sure `CoreBindings.cs` uses `CallingConvention.Cdecl` and correct struct layouts.
  - Keep `CoreBindings.cs` in sync with the C API (`docs/API.md`).

## Live reload (optional)
- Approach 1: File watcher in Unity to reload meshes when an exported file changes.
- Approach 2: IPC (named pipe/socket) to stream updates from the Qt editor.
- Start with file-based hot reload for simplicity.
