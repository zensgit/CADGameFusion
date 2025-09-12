using System;
using System.Runtime.InteropServices;

namespace CADGameFusion.UnityAdapter {
    public static class CoreBindings {
        const string DLL = "core_c"; // core_c.dll (Win) / libcore_c.dylib (macOS) / libcore_c.so (Linux)

        [StructLayout(LayoutKind.Sequential)]
        public struct Vec2 { public double x, y; }

        public struct Document { public IntPtr Ptr; }

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

        public static uint[] Triangulate(Vec2[] pts) {
            int count = 0;
            if (core_triangulate_polygon(pts, pts.Length, IntPtr.Zero, ref count) == 0 || count <= 0) return Array.Empty<uint>();
            var indices = new uint[count];
            if (core_triangulate_polygon(pts, pts.Length, indices, ref count) == 0) return Array.Empty<uint>();
            return indices;
        }
    }
}
