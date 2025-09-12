using UnityEngine;
using CADGameFusion.UnityAdapter;

public class SampleBehaviour : MonoBehaviour {
    void Start() {
        // Log version & features
        var verPtr = CoreBindings.core_get_version();
        string ver = Marshal.PtrToStringAnsi(verPtr) ?? "unknown";
        uint feats = CoreBindings.core_get_feature_flags();
        Debug.Log($"core_c version={ver} features=[EARCUT={(feats & 1u)!=0}, CLIPPER2={(feats & 2u)!=0}]");

        var doc = CoreBindings.CreateDocument();
        var pts = new CoreBindings.Vec2[]{ new(){x=0,y=0}, new(){x=1,y=0}, new(){x=1,y=1} };
        var id = CoreBindings.core_document_add_polyline(doc.Ptr, pts, pts.Length);
        Debug.Log($"Created polyline id={id}");
        CoreBindings.Destroy(doc);
    }
}
