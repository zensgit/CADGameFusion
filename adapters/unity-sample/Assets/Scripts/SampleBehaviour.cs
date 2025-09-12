using UnityEngine;
using CADGameFusion.UnityAdapter;

public class SampleBehaviour : MonoBehaviour {
    void Start() {
        var doc = CoreBindings.CreateDocument();
        var pts = new CoreBindings.Vec2[]{ new(){x=0,y=0}, new(){x=1,y=0}, new(){x=1,y=1} };
        var id = CoreBindings.core_document_add_polyline(doc.Ptr, pts, pts.Length);
        Debug.Log($"Created polyline id={id}");
        CoreBindings.Destroy(doc);
    }
}

