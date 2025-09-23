using UnityEngine;
using CADGameFusion.UnityAdapter;

[RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
public class OffsetToMesh : MonoBehaviour {
    public Vector2[] polygon = new Vector2[] { new(0,0), new(1,0), new(1,1), new(0,1) };
    public float delta = 0.1f;

    void Start() { Generate(); }

    public void Regenerate() { Generate(); }

    private void Generate() {
        var pts = new CoreBindings.Vec2[polygon.Length];
        for (int i=0;i<polygon.Length;i++) pts[i] = new CoreBindings.Vec2{ x=polygon[i].x, y=polygon[i].y };

        var res = CoreBindings.OffsetSingle(pts, delta);
        if (res.polyCount <= 0 || res.totalPoints <= 0) { Debug.LogWarning("Offset failed or empty."); return; }
        // For demo: consider only the first polygon, then triangulate via core API
        int firstCnt = res.counts[0];
        var poly = new CoreBindings.Vec2[firstCnt];
        for (int i=0;i<firstCnt;i++) poly[i] = res.pts[i];

        // Build vertex array for Unity mesh
        var verts = new Vector3[firstCnt];
        for (int i=0;i<firstCnt;i++) verts[i] = new Vector3((float)poly[i].x, (float)poly[i].y, 0);

        // Triangulate using core library; fallback to simple fan if needed
        var idx = CoreBindings.Triangulate(poly);
        int[] triangles;
        if (idx.Length >= 3) {
            triangles = new int[idx.Length];
            for (int i=0;i<idx.Length;i++) triangles[i] = (int)idx[i];
        } else {
            var tris = new System.Collections.Generic.List<int>();
            for (int i=1;i<firstCnt-1;i++) { tris.Add(0); tris.Add(i); tris.Add(i+1); }
            triangles = tris.ToArray();
        }

        var mesh = new Mesh();
        mesh.indexFormat = (verts.Length > 65535) ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
        mesh.vertices = verts;
        mesh.triangles = triangles;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        GetComponent<MeshFilter>().sharedMesh = mesh;
    }
}
