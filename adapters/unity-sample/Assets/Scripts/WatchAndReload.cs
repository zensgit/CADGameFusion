using UnityEngine;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using CADGameFusion;
using CADGameFusion.UnityAdapter;

public class WatchAndReload : MonoBehaviour {
    public string exportBasePath;
    public float pollInterval = 1.0f;
    public bool preferGltf = true; // Toggle for glTF preference

    string lastSceneDir = null;
    float timer = 0f;

    void Start() {
        LogAbiStatus();
    }

    void Update() {
        timer += Time.deltaTime;
        if (timer < pollInterval) return;
        timer = 0f;
        TryReloadLatestScene();
    }

    static void LogAbiStatus() {
        int abi = CoreBindings.cadgf_get_abi_version();
        bool ok = (abi == CoreBindings.CADGF_ABI_VERSION);
        var verPtr = CoreBindings.cadgf_get_version();
        string version = Marshal.PtrToStringAnsi(verPtr) ?? "unknown";
        uint feats = CoreBindings.cadgf_get_feature_flags();
        Debug.Log($"[WatchAndReload] cadgf abi={abi} (expected {CoreBindings.CADGF_ABI_VERSION}, ok={ok}) version={version} features=[EARCUT={(feats & 1u)!=0}, CLIPPER2={(feats & 2u)!=0}]");
        if (!ok) {
            Debug.LogError("CADGameFusion core ABI mismatch detected; exporter/importer artifacts may be incompatible.");
        }
    }

    void TryReloadLatestScene() {
        if (string.IsNullOrEmpty(exportBasePath) || !Directory.Exists(exportBasePath)) return;
        string latest = null; System.DateTime latestTime = System.DateTime.MinValue;
        foreach (var d in Directory.GetDirectories(exportBasePath, "scene_*")) {
            var t = Directory.GetLastWriteTime(d);
            if (t > latestTime) { latestTime = t; latest = d; }
        }
        if (latest == null || latest == lastSceneDir) return;
        lastSceneDir = latest;
        Debug.Log($"Reloading scene from {latest}");
        foreach (var go in GameObject.FindGameObjectsWithTag("Generated")) Destroy(go);
        foreach (var json in Directory.GetFiles(latest, "group_*.json")) {
            try {
                string txt = File.ReadAllText(json);
                var data = JsonUtility.FromJson<GroupDataWrapper>(WrapJson(txt));
                if (data == null || data.root == null) continue;
                var meshGo = new GameObject(Path.GetFileNameWithoutExtension(json));
                meshGo.tag = "Generated";
                var mf = meshGo.AddComponent<MeshFilter>();
                var mr = meshGo.AddComponent<MeshRenderer>();
                mr.sharedMaterial = new Material(Shader.Find("Standard"));
                // Prefer glTF if enabled and available
                if (preferGltf) {
                    var gltfPath = Path.Combine(Path.GetDirectoryName(json), 
                        Path.GetFileName(json).Replace("group_", "mesh_group_").Replace(".json", ".gltf"));
                    
                    if (File.Exists(gltfPath)) {
                        Debug.Log($"[glTF] Loading mesh from {Path.GetFileName(gltfPath)}");
                        var gltfMesh = MinimalGltfLoader.LoadGltfMesh(gltfPath);
                        if (gltfMesh != null) { 
                            mf.sharedMesh = gltfMesh; 
                            continue; 
                        }
                        Debug.LogWarning($"[glTF] Failed to load {Path.GetFileName(gltfPath)}, falling back to JSON triangulation");
                    }
                }
                // Build polygon with holes using core C API triangulation (rings)
                if (data.root.flat_pts != null && data.root.ring_counts != null) {
                    // Prepare flat points for C API
                    var pts = new CADGameFusion.UnityAdapter.CoreBindings.Vec2[data.root.flat_pts.Length];
                    for (int i=0;i<pts.Length;i++) pts[i] = new CADGameFusion.UnityAdapter.CoreBindings.Vec2{ x=data.root.flat_pts[i].x, y=data.root.flat_pts[i].y };
                    var indices = CADGameFusion.UnityAdapter.CoreBindings.TriangulateRings(pts, data.root.ring_counts);
                    if (indices.Length == 0) {
                        Debug.LogWarning("TriangulateRings returned empty; falling back to outer-only fan.");
                        // fallback: outer-only fan
                        var vertsF = new List<Vector3>(); var idxF = new List<int>(); int off=0;
                        foreach (int cnt in data.root.ring_counts) { for (int i=0;i<cnt;i++) vertsF.Add(new Vector3((float)data.root.flat_pts[off+i].x,(float)data.root.flat_pts[off+i].y,0)); for (int i=1;i+1<cnt;i++){ idxF.Add(0); idxF.Add(i); idxF.Add(i+1);} off+=cnt; break; }
                        var mfallback = new Mesh();
                        mfallback.indexFormat = (vertsF.Count > 65535) ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
                        mfallback.SetVertices(vertsF);
                        mfallback.SetTriangles(idxF,0);
                        mfallback.RecalculateNormals(); mfallback.RecalculateBounds(); mf.sharedMesh = mfallback;
                    } else {
                        // Build vertex list directly from flat_pts
                        var verts = new List<Vector3>(data.root.flat_pts.Length);
                        foreach (var p in data.root.flat_pts) verts.Add(new Vector3((float)p.x,(float)p.y,0));
                        var m = new Mesh();
                        m.indexFormat = (verts.Count > 65535) ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
                        m.SetVertices(verts);
                        var tris = new int[indices.Length]; for (int i=0;i<indices.Length;i++) tris[i]=(int)indices[i];
                        m.SetTriangles(tris, 0);
                        m.RecalculateNormals(); m.RecalculateBounds();
                        mf.sharedMesh = m;
                    }
                }
            } catch (System.Exception ex) {
                Debug.LogWarning($"Failed to load {json}: {ex.Message}");
            }
        }
    }

    // Unity's JsonUtility requires a root object; wrap parsed json
    static string WrapJson(string src) { return "{\"root\":" + src + "}"; }
    [System.Serializable]
    public class GroupDataWrapper { public GroupData root; }
    [System.Serializable]
    public class GroupData {
        public int groupId;
        public FlatPt[] flat_pts;
        public int[] ring_counts;
        public int[] ring_roles; // 0=outer,1=hole
    }
    [System.Serializable]
    public class FlatPt { public double x; public double y; }
}
