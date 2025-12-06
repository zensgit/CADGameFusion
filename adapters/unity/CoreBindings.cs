using System;
using System.Runtime.InteropServices;

namespace CADGameFusion.UnityAdapter {
    public static class CoreBindings {
        const string DLL = "core_c"; // core_c.dll (Win) / libcore_c.dylib (macOS) / libcore_c.so (Linux)

        [StructLayout(LayoutKind.Sequential)]
        public struct Vec2 { public double x, y; }

        public struct Document { public IntPtr Ptr; }

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr core_get_version();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern uint core_get_feature_flags();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr core_document_create();

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern void core_document_destroy(IntPtr doc);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern UInt64 core_document_add_polyline(IntPtr doc, [In] Vec2[] pts, int n);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_document_remove_entity(IntPtr doc, UInt64 id);

        // Convenience wrappers
        public static Document CreateDocument() => new Document { Ptr = core_document_create() };
        public static void Destroy(Document d) { if (d.Ptr != IntPtr.Zero) core_document_destroy(d.Ptr); }

        // Triangulation API (two-call pattern). Provide overloads for query and fill.
        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_triangulate_polygon([In] Vec2[] pts, int n, IntPtr indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_triangulate_polygon([In] Vec2[] pts, int n, [Out] uint[] indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_triangulate_polygon_rings([In] Vec2[] pts, [In] int[] ring_counts, int ring_count, IntPtr indices, ref int index_count);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_triangulate_polygon_rings([In] Vec2[] pts, [In] int[] ring_counts, int ring_count, [Out] uint[] indices, ref int index_count);

        public static uint[] Triangulate(Vec2[] pts) {
            int count = 0;
            if (core_triangulate_polygon(pts, pts.Length, IntPtr.Zero, ref count) == 0 || count <= 0) return Array.Empty<uint>();
            var indices = new uint[count];
            if (core_triangulate_polygon(pts, pts.Length, indices, ref count) == 0) return Array.Empty<uint>();
            return indices;
        }

        public static uint[] TriangulateRings(Vec2[] flatPts, int[] ringCounts) {
            int count = 0;
            if (core_triangulate_polygon_rings(flatPts, ringCounts, ringCounts.Length, IntPtr.Zero, ref count) == 0 || count <= 0) return Array.Empty<uint>();
            var indices = new uint[count];
            if (core_triangulate_polygon_rings(flatPts, ringCounts, ringCounts.Length, indices, ref count) == 0) return Array.Empty<uint>();
            return indices;
        }

        // Offset (single-contour helpers) — two-call pattern
        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_offset_single([In] Vec2[] poly, int n, double delta,
                                                    IntPtr out_pts, IntPtr out_counts,
                                                    ref int poly_count, ref int total_pts);

        [DllImport(DLL, CallingConvention = CallingConvention.Cdecl)]
        public static extern int core_offset_single([In] Vec2[] poly, int n, double delta,
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
            if (core_offset_single(poly, poly.Length, delta, IntPtr.Zero, IntPtr.Zero, ref pc, ref tp) == 0 || pc <= 0 || tp <= 0) {
                return new OffsetResult { pts = Array.Empty<Vec2>(), counts = Array.Empty<int>(), polyCount = 0, totalPoints = 0 };
            }
            var pts = new Vec2[tp];
            var counts = new int[pc];
            if (core_offset_single(poly, poly.Length, delta, pts, counts, ref pc, ref tp) == 0) {
                return new OffsetResult { pts = Array.Empty<Vec2>(), counts = Array.Empty<int>(), polyCount = 0, totalPoints = 0 };
            }
            return new OffsetResult { pts = pts, counts = counts, polyCount = pc, totalPoints = tp };
        }
    }
}
