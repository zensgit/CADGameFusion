using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

namespace CADGameFusion
{
    /// <summary>
    /// Minimal glTF 2.0 loader for CADGameFusion exports
    /// Supports only the subset we generate:
    /// - Single buffer with .bin file
    /// - POSITION attribute (VEC3, FLOAT)
    /// - Indices (SCALAR, UNSIGNED_INT)
    /// - Single mesh/primitive/node/scene
    /// </summary>
    public static class MinimalGltfLoader
    {
        [Serializable]
        public class GltfRoot
        {
            public GltfAsset asset;
            public List<GltfBuffer> buffers;
            public List<GltfBufferView> bufferViews;
            public List<GltfAccessor> accessors;
            public List<GltfMesh> meshes;
            public List<GltfNode> nodes;
            public List<GltfScene> scenes;
            public int scene;
        }

        [Serializable]
        public class GltfAsset
        {
            public string version;
        }

        [Serializable]
        public class GltfBuffer
        {
            public string uri;
            public int byteLength;
        }

        [Serializable]
        public class GltfBufferView
        {
            public int buffer;
            public int byteOffset;
            public int byteLength;
            public int target;
        }

        [Serializable]
        public class GltfAccessor
        {
            public int bufferView;
            public int byteOffset;
            public int componentType;
            public int count;
            public string type;
            public float[] min;
            public float[] max;
        }

        [Serializable]
        public class GltfMesh
        {
            public List<GltfPrimitive> primitives;
        }

        [Serializable]
        public class GltfPrimitive
        {
            public GltfAttributes attributes;
            public int indices;
        }

        [Serializable]
        public class GltfAttributes
        {
            public int POSITION;
        }

        [Serializable]
        public class GltfNode
        {
            public int mesh;
        }

        [Serializable]
        public class GltfScene
        {
            public List<int> nodes;
        }

        /// <summary>
        /// Load a glTF file and create a Unity Mesh
        /// </summary>
        public static Mesh LoadGltfMesh(string gltfPath)
        {
            try
            {
                // Parse glTF JSON
                string json = File.ReadAllText(gltfPath);
                GltfRoot gltf = JsonUtility.FromJson<GltfRoot>(json);

                if (gltf == null || gltf.buffers == null || gltf.buffers.Count == 0)
                {
                    Debug.LogError($"Invalid glTF structure in {gltfPath}");
                    return null;
                }

                // Load binary buffer
                string dir = Path.GetDirectoryName(gltfPath);
                string binPath = Path.Combine(dir, gltf.buffers[0].uri);
                
                if (!File.Exists(binPath))
                {
                    Debug.LogError($"Binary file not found: {binPath}");
                    return null;
                }

                byte[] binData = File.ReadAllBytes(binPath);

                // Get mesh primitive
                if (gltf.meshes == null || gltf.meshes.Count == 0)
                {
                    Debug.LogError($"No meshes in glTF: {gltfPath}");
                    return null;
                }

                var primitive = gltf.meshes[0].primitives[0];
                
                // Load positions
                Vector3[] vertices = LoadPositions(gltf, binData, primitive.attributes.POSITION);
                if (vertices == null || vertices.Length == 0)
                {
                    Debug.LogError($"Failed to load positions from {gltfPath}");
                    return null;
                }

                // Load indices
                int[] triangles = LoadIndices(gltf, binData, primitive.indices);
                if (triangles == null || triangles.Length == 0)
                {
                    Debug.LogError($"Failed to load indices from {gltfPath}");
                    return null;
                }

                // Create Unity Mesh
                Mesh mesh = new Mesh();
                mesh.name = Path.GetFileNameWithoutExtension(gltfPath);
                mesh.vertices = vertices;
                mesh.triangles = triangles;
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();

                Debug.Log($"Loaded glTF mesh: {mesh.name} ({vertices.Length} verts, {triangles.Length / 3} tris)");
                return mesh;
            }
            catch (Exception e)
            {
                Debug.LogError($"Error loading glTF {gltfPath}: {e.Message}");
                return null;
            }
        }

        private static Vector3[] LoadPositions(GltfRoot gltf, byte[] binData, int accessorIndex)
        {
            var accessor = gltf.accessors[accessorIndex];
            var bufferView = gltf.bufferViews[accessor.bufferView];

            // Validate it's VEC3 FLOAT
            if (accessor.type != "VEC3" || accessor.componentType != 5126) // 5126 = FLOAT
            {
                Debug.LogError($"Unsupported position format: {accessor.type} / {accessor.componentType}");
                return null;
            }

            Vector3[] positions = new Vector3[accessor.count];
            int offset = bufferView.byteOffset + accessor.byteOffset;

            for (int i = 0; i < accessor.count; i++)
            {
                int idx = offset + i * 12; // 3 floats * 4 bytes
                float x = BitConverter.ToSingle(binData, idx);
                float y = BitConverter.ToSingle(binData, idx + 4);
                float z = BitConverter.ToSingle(binData, idx + 8);
                
                // Unity uses left-handed Y-up, glTF is right-handed Y-up
                // For 2D (z=0), we just use x,y directly
                positions[i] = new Vector3(x, y, z);
            }

            return positions;
        }

        private static int[] LoadIndices(GltfRoot gltf, byte[] binData, int accessorIndex)
        {
            var accessor = gltf.accessors[accessorIndex];
            var bufferView = gltf.bufferViews[accessor.bufferView];

            // Validate it's SCALAR UNSIGNED_INT
            if (accessor.type != "SCALAR" || accessor.componentType != 5125) // 5125 = UNSIGNED_INT
            {
                Debug.LogError($"Unsupported index format: {accessor.type} / {accessor.componentType}");
                return null;
            }

            int[] indices = new int[accessor.count];
            int offset = bufferView.byteOffset + accessor.byteOffset;

            for (int i = 0; i < accessor.count; i++)
            {
                int idx = offset + i * 4; // uint32 = 4 bytes
                indices[i] = BitConverter.ToInt32(binData, idx);
            }

            return indices;
        }

        /// <summary>
        /// Check if a glTF file exists for the given group
        /// </summary>
        public static bool GltfExists(string directory, int groupId)
        {
            string gltfPath = Path.Combine(directory, $"mesh_group_{groupId}.gltf");
            return File.Exists(gltfPath);
        }

        /// <summary>
        /// Load glTF mesh for a specific group
        /// </summary>
        public static Mesh LoadGroupMesh(string directory, int groupId)
        {
            string gltfPath = Path.Combine(directory, $"mesh_group_{groupId}.gltf");
            if (!File.Exists(gltfPath))
            {
                return null;
            }
            return LoadGltfMesh(gltfPath);
        }
    }
}