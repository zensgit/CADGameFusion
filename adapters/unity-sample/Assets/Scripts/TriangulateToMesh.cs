using UnityEngine;
using CADGameFusion.UnityAdapter;

[RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
public class TriangulateToMesh : MonoBehaviour {
    public Vector2[] polygon = new Vector2[] { new(0,0), new(1,0), new(1,1) };

    void Start() {
        var pts = new CoreBindings.Vec2[polygon.Length];
        for (int i=0;i<polygon.Length;i++) pts[i] = new CoreBindings.Vec2{ x=polygon[i].x, y=polygon[i].y };
        var indices = CoreBindings.Triangulate(pts);
        if (indices.Length == 0) { Debug.LogWarning("Triangulation failed or empty."); return; }
        var verts = new Vector3[polygon.Length];
        for (int i=0;i<polygon.Length;i++) verts[i] = new Vector3(polygon[i].x, polygon[i].y, 0);
        var mesh = new Mesh();
        mesh.indexFormat = (verts.Length > 65535) ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
        mesh.vertices = verts;
        var tris = new int[indices.Length];
        for (int i=0;i<indices.Length;i++) tris[i] = (int)indices[i];
        mesh.triangles = tris;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        GetComponent<MeshFilter>().sharedMesh = mesh;
    }
}

