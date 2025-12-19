using System;
using System.Runtime.InteropServices;

namespace CADGameFusion.UnityAdapter {
    public static class CoreBindings {
        const string DLL = "core_c"; // core_c.dll (Win) / libcore_c.dylib (macOS) / libcore_c.so (Linux)

        [StructLayout(LayoutKind.Sequential)]
        public struct Vec2 { public double x, y; }

        public struct Document { public IntPtr Ptr; }

        // Preferred C API prefix (stable ABI): cadgf_*
        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr cadgf_get_version();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern uint cadgf_get_feature_flags();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr cadgf_document_create();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern void cadgf_document_destroy(IntPtr doc);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern UInt64 cadgf_document_add_polyline(IntPtr doc, [In] Vec2[] pts, int n);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_document_remove_entity(IntPtr doc, UInt64 id);

        // Convenience wrappers
        public static Document CreateDocument() => new Document { Ptr = cadgf_document_create() };
        public static void Destroy(Document d) { if (d.Ptr != IntPtr.Zero) cadgf_document_destroy(d.Ptr); }

        // Triangulation API (two-call pattern). Provide overloads for query and fill.
        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_triangulate_polygon([In] Vec2[] pts, int n, IntPtr indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_triangulate_polygon([In] Vec2[] pts, int n, [Out] uint[] indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_triangulate_polygon_rings([In] Vec2[] pts, [In] int[] ring_counts, int ring_count, IntPtr indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_triangulate_polygon_rings([In] Vec2[] pts, [In] int[] ring_counts, int ring_count, [Out] uint[] indices, ref int index_count);

        public static uint[] Triangulate(Vec2[] pts) {
            int count = 0;
            if (cadgf_triangulate_polygon(pts, pts.Length, IntPtr.Zero, ref count) == 0 || count <= 0) return Array.Empty<uint>();
            var indices = new uint[count];
            if (cadgf_triangulate_polygon(pts, pts.Length, indices, ref count) == 0) return Array.Empty<uint>();
            return indices;
        }

        public static uint[] TriangulateRings(Vec2[] flatPts, int[] ringCounts) {
            int count = 0;
            if (cadgf_triangulate_polygon_rings(flatPts, ringCounts, ringCounts.Length, IntPtr.Zero, ref count) == 0 || count <= 0) return Array.Empty<uint>();
            var indices = new uint[count];
            if (cadgf_triangulate_polygon_rings(flatPts, ringCounts, ringCounts.Length, indices, ref count) == 0) return Array.Empty<uint>();
            return indices;
        }

        // Offset (single-contour helpers) — two-call pattern
        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_offset_single([In] Vec2[] poly, int n, double delta,
                                                    IntPtr out_pts, IntPtr out_counts,
                                                    ref int poly_count, ref int total_pts);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int cadgf_offset_single([In] Vec2[] poly, int n, double delta,
                                                    [Out] Vec2[] out_pts, [Out] int[] out_counts,
                                                    ref int poly_count, ref int total_pts);

        public struct OffsetResult {
            public Vec2[] pts;        // flattened points of all output polygons
            public int[] counts;       // vertex counts per polygon
            public int polyCount;      // number of output polygons
            public int totalPoints;    // total points across polygons
        }

        public static OffsetResult OffsetSingle(Vec2[] poly, double delta) {
            int pc = 0, tp = 0;
            // Query sizes
            if (cadgf_offset_single(poly, poly.Length, delta, IntPtr.Zero, IntPtr.Zero, ref pc, ref tp) == 0 || pc <= 0 || tp <= 0) {
                return new OffsetResult { pts = Array.Empty<Vec2>(), counts = Array.Empty<int>(), polyCount = 0, totalPoints = 0 };
            }
            var pts = new Vec2[tp];
            var counts = new int[pc];
            if (cadgf_offset_single(poly, poly.Length, delta, pts, counts, ref pc, ref tp) == 0) {
                return new OffsetResult { pts = Array.Empty<Vec2>(), counts = Array.Empty<int>(), polyCount = 0, totalPoints = 0 };
            }
            return new OffsetResult { pts = pts, counts = counts, polyCount = pc, totalPoints = tp };
        }

        // Legacy managed aliases (core_*), preserved for older Unity scripts.
        [Obsolete("Use cadgf_get_version")]
        public static IntPtr core_get_version() => cadgf_get_version();

        [Obsolete("Use cadgf_get_feature_flags")]
        public static uint core_get_feature_flags() => cadgf_get_feature_flags();

        [Obsolete("Use cadgf_document_create")]
        public static IntPtr core_document_create() => cadgf_document_create();

        [Obsolete("Use cadgf_document_destroy")]
        public static void core_document_destroy(IntPtr doc) => cadgf_document_destroy(doc);

        [Obsolete("Use cadgf_document_add_polyline")]
        public static UInt64 core_document_add_polyline(IntPtr doc, Vec2[] pts, int n) => cadgf_document_add_polyline(doc, pts, n);

        [Obsolete("Use cadgf_document_remove_entity")]
        public static int core_document_remove_entity(IntPtr doc, UInt64 id) => cadgf_document_remove_entity(doc, id);

        [Obsolete("Use cadgf_triangulate_polygon")]
        public static int core_triangulate_polygon(Vec2[] pts, int n, IntPtr indices, ref int index_count)
            => cadgf_triangulate_polygon(pts, n, indices, ref index_count);

        [Obsolete("Use cadgf_triangulate_polygon")]
        public static int core_triangulate_polygon(Vec2[] pts, int n, uint[] indices, ref int index_count)
            => cadgf_triangulate_polygon(pts, n, indices, ref index_count);

        [Obsolete("Use cadgf_triangulate_polygon_rings")]
        public static int core_triangulate_polygon_rings(Vec2[] pts, int[] ring_counts, int ring_count, IntPtr indices, ref int index_count)
            => cadgf_triangulate_polygon_rings(pts, ring_counts, ring_count, indices, ref index_count);

        [Obsolete("Use cadgf_triangulate_polygon_rings")]
        public static int core_triangulate_polygon_rings(Vec2[] pts, int[] ring_counts, int ring_count, uint[] indices, ref int index_count)
            => cadgf_triangulate_polygon_rings(pts, ring_counts, ring_count, indices, ref index_count);

        [Obsolete("Use cadgf_offset_single")]
        public static int core_offset_single(Vec2[] poly, int n, double delta,
                                             IntPtr out_pts, IntPtr out_counts,
                                             ref int poly_count, ref int total_pts)
            => cadgf_offset_single(poly, n, delta, out_pts, out_counts, ref poly_count, ref total_pts);

        [Obsolete("Use cadgf_offset_single")]
        public static int core_offset_single(Vec2[] poly, int n, double delta,
                                             Vec2[] out_pts, int[] out_counts,
                                             ref int poly_count, ref int total_pts)
            => cadgf_offset_single(poly, n, delta, out_pts, out_counts, ref poly_count, ref total_pts);
    }
}
