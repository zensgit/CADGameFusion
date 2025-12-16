#include "exporter.hpp"

#include <QDateTime>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QVector3D>
#include <QTextStream>
// Define implementations only in one place (e.g. main.cpp or here if strictly needed)
// But since export_cli.cpp already defines them, we might get duplicate symbols if linked together?
// No, export_cli is a separate executable. editor_qt is separate.
// So we need definitions here too for editor_qt.
#define TINYGLTF_IMPLEMENTATION
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <tiny_gltf.h>

#include "core/core_c_api.h"

static QString makeSceneDir(const QDir& base) {
    const QString ts = QDateTime::currentDateTime().toString("yyyyMMdd_HHmmss");
    return base.filePath(QString("scene_%1").arg(ts));
}

static QJsonArray toJsonRing(const QVector<QPointF>& ring) {
    QJsonArray arr;
    for (const auto& p : ring) {
        QJsonArray pt; pt.append(p.x()); pt.append(p.y());
        arr.append(pt);
    }
    return arr;
}

static double signedArea(const QVector<QPointF>& ring) {
    int n = ring.size();
    if (n < 3) return 0.0;
    // ignore closing duplicate if present
    int end = n;
    if (ring.first() == ring.last()) end = n-1;
    if (end < 3) return 0.0;
    double a = 0.0;
    for (int i=0,j=end-1; i<end; j=i++) {
        a += ring[j].x()*ring[i].y() - ring[i].x()*ring[j].y();
    }
    return 0.5 * a;
}

static bool writeDXF(const QString& filename, const QVector<ExportItem>& items, double unitScale) {
    QFile f(filename);
    if (!f.open(QIODevice::WriteOnly | QIODevice::Text)) return false;
    QTextStream out(&f);

    // Header
    out << "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";

    // Entities
    out << "0\nSECTION\n2\nENTITIES\n";

    for (const auto& item : items) {
        for (const auto& ring : item.rings) {
            if (ring.size() < 2) continue;

            bool closed = (ring.first() == ring.last());
            int count = ring.size();
            if (closed) count--; // Don't write the duplicate last vertex for LWPOLYLINE logic if we set flag 1
            if (count < 2) continue;

            out << "0\nLWPOLYLINE\n";
            out << "8\n0\n"; // Layer 0
            out << "90\n" << count << "\n"; // Number of vertices
            out << "70\n" << (closed ? 1 : 0) << "\n"; // 1 = Closed, 0 = Open

            for (int i = 0; i < count; ++i) {
                const auto& p = ring[i];
                out << "10\n" << (p.x() * unitScale) << "\n";
                out << "20\n" << (-p.y() * unitScale) << "\n"; // Flip Y for CAD
            }
        }
    }

    out << "0\nENDSEC\n";
    out << "0\nEOF\n";
    f.close();
    return true;
}

ExportResult exportScene(const QVector<ExportItem>& items, const QDir& baseDir, int kinds, double unitScale,
                        const QJsonObject& meta, bool writeRingRoles, bool includeHolesGLTF) {
    ExportResult res;
    QDir dir(baseDir);
    const QString sceneDir = makeSceneDir(dir);
    if (!dir.mkpath(sceneDir)) { res.error = "Failed to create scene dir"; return res; }
    QDir sdir(sceneDir);

    // DXF Export
    if (kinds & ExportDXF) {
        const QString dxfName = sdir.filePath("scene.dxf");
        if (writeDXF(dxfName, items, unitScale)) {
            res.written << dxfName;
        } else {
            res.error += "Failed to write DXF. ";
        }
    }

    // Write per-group rings JSON with flattened pts and ring_counts
    for (const auto& it : items) {
        QJsonObject root;
        root.insert("groupId", it.groupId);
        // Backward/forward compatibility: also write snake_case key if external tools expect it
        root.insert("group_id", it.groupId);
        // legacy polygons (optional)
        QJsonArray polys;
        for (const auto& ring : it.rings) { QJsonObject poly; poly.insert("outer", toJsonRing(ring)); poly.insert("holes", QJsonArray{}); polys.append(poly); }
        root.insert("polygons", polys);

        // flat_pts as objects {x,y} and ring_counts
        QJsonArray flatPts;
        QJsonArray counts;
        for (const auto& ring : it.rings) {
            counts.append(static_cast<int>(ring.size()));
            for (const auto& p : ring) { QJsonObject o; o.insert("x", p.x()); o.insert("y", p.y()); flatPts.append(o); }
        }
        root.insert("flat_pts", flatPts);
        root.insert("ring_counts", counts);

        // ring_roles: 0=outer(CCW), 1=hole(CW) by orientation heuristic
        if (writeRingRoles) {
            QJsonArray roles;
            for (const auto& ring : it.rings) {
                double a = signedArea(ring);
                roles.append(a > 0.0 ? 0 : 1);
            }
            root.insert("ring_roles", roles);
        }

        // Compose meta: provided meta + pipeline info
        QJsonObject metaOut = meta;
        metaOut.insert("pipelineVersion", QStringLiteral("0.3.0"));
        metaOut.insert("source", QStringLiteral("qt"));
        metaOut.insert("exportTime", QDateTime::currentDateTimeUtc().toString(Qt::ISODate));
        root.insert("meta", metaOut);
        if (kinds & ExportJSON) {
            QJsonDocument doc(root);
            const QString fn = sdir.filePath(QString("group_%1.json").arg(it.groupId));
            QFile f(fn);
            if (f.open(QIODevice::WriteOnly)) { f.write(doc.toJson()); f.close(); res.written << fn; }
        }

        // Write minimal glTF + bin for this group (positions + indices)
        // 1) Build flat points and ring counts for triangulation
        QVector<core_vec2> flat;
        QVector<int> rc; flat.reserve(128);
        if (includeHolesGLTF) {
            for (const auto& ring : it.rings) {
                rc.push_back(ring.size());
                for (const auto& p : ring) flat.push_back(core_vec2{p.x()*unitScale, p.y()*unitScale});
            }
        } else {
            // Heuristic: pick the largest CCW ring as outer
            int pick = -1; double best = 0.0;
            for (int rIndex = 0; rIndex < it.rings.size(); ++rIndex) {
                double a = signedArea(it.rings[rIndex]);
                double ab = std::abs(a);
                if (a > 0.0 && ab > best) { best = ab; pick = rIndex; }
            }
            if (pick < 0 && !it.rings.isEmpty()) pick = 0; // fallback
            if (pick >= 0) {
                const auto& ring = it.rings[pick];
                rc.push_back(ring.size());
                for (const auto& p : ring) flat.push_back(core_vec2{p.x()*unitScale, p.y()*unitScale});
            }
        }
        // 2) Triangulate via C API (rings)
        int idxCount = 0;
        bool triangulated = false;
        if ((kinds & ExportGLTF) && !flat.isEmpty() && !rc.isEmpty()) {
            if (core_triangulate_polygon_rings(flat.data(), rc.data(), rc.size(), nullptr, &idxCount) && idxCount > 0) {
                QVector<unsigned int> indices; indices.resize(idxCount);
                if (core_triangulate_polygon_rings(flat.data(), rc.data(), rc.size(), indices.data(), &idxCount)) {
                    tinygltf::Model gltfModel;
                    tinygltf::Scene gltfScene;
                    tinygltf::Mesh gltfMesh;
                    tinygltf::Primitive gltfPrimitive;

                    // Asset
                    gltfModel.asset.version = "2.0";
                    gltfModel.asset.generator = "CADGameFusion_Qt_Exporter";

                    // Vertices (Positions)
                    std::vector<float> positions;
                    positions.reserve(flat.size() * 3);
                    float minX = std::numeric_limits<float>::max(), minY = minX, minZ = 0.0f;
                    float maxX = std::numeric_limits<float>::lowest(), maxY = maxX, maxZ = 0.0f;
                    for (const auto& p : flat) {
                        float x = static_cast<float>(p.x);
                        float y = static_cast<float>(p.y);
                        positions.push_back(x);
                        positions.push_back(y);
                        positions.push_back(0.0f); // 2D geometry in XY plane

                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }

                    // Indices
                    std::vector<unsigned int> gltfIndices(indices.begin(), indices.end());

                    // Buffer (positions + indices)
                    tinygltf::Buffer buffer;
                    buffer.data.resize(positions.size() * sizeof(float) + gltfIndices.size() * sizeof(unsigned int));
                    
                    unsigned char* bufferPtr = buffer.data.data();
                    std::memcpy(bufferPtr, positions.data(), positions.size() * sizeof(float));
                    std::memcpy(bufferPtr + positions.size() * sizeof(float), gltfIndices.data(), gltfIndices.size() * sizeof(unsigned int));
                    
                    // Set URI for separate binary file
                    QString binName = QString("mesh_group_%1.bin").arg(it.groupId);
                    buffer.uri = binName.toStdString();
                    gltfModel.buffers.push_back(buffer);

                    // BufferViews
                    tinygltf::BufferView posBufferView;
                    posBufferView.buffer = 0;
                    posBufferView.byteOffset = 0;
                    posBufferView.byteLength = positions.size() * sizeof(float);
                    posBufferView.target = TINYGLTF_TARGET_ARRAY_BUFFER;
                    gltfModel.bufferViews.push_back(posBufferView);

                    tinygltf::BufferView idxBufferView;
                    idxBufferView.buffer = 0;
                    idxBufferView.byteOffset = positions.size() * sizeof(float);
                    idxBufferView.byteLength = gltfIndices.size() * sizeof(unsigned int);
                    idxBufferView.target = TINYGLTF_TARGET_ELEMENT_ARRAY_BUFFER;
                    gltfModel.bufferViews.push_back(idxBufferView);

                    // Accessors
                    tinygltf::Accessor posAccessor;
                    posAccessor.bufferView = 0;
                    posAccessor.byteOffset = 0;
                    posAccessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
                    posAccessor.count = flat.size();
                    posAccessor.type = TINYGLTF_TYPE_VEC3;
                    posAccessor.minValues = {static_cast<double>(minX), static_cast<double>(minY), static_cast<double>(minZ)};
                    posAccessor.maxValues = {static_cast<double>(maxX), static_cast<double>(maxY), static_cast<double>(maxZ)};
                    gltfModel.accessors.push_back(posAccessor);

                    tinygltf::Accessor idxAccessor;
                    idxAccessor.bufferView = 1;
                    idxAccessor.byteOffset = 0;
                    idxAccessor.componentType = TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT;
                    idxAccessor.count = gltfIndices.size();
                    idxAccessor.type = TINYGLTF_TYPE_SCALAR;
                    gltfModel.accessors.push_back(idxAccessor);

                    // Primitive
                    gltfPrimitive.attributes["POSITION"] = 0;
                    gltfPrimitive.indices = 1;
                    gltfPrimitive.mode = TINYGLTF_MODE_TRIANGLES;
                    gltfMesh.primitives.push_back(gltfPrimitive);
                    gltfModel.meshes.push_back(gltfMesh);

                    // Node
                    tinygltf::Node node;
                    node.mesh = 0;
                    gltfModel.nodes.push_back(node);

                    // Scene
                    gltfScene.nodes.push_back(0);
                    gltfModel.scenes.push_back(gltfScene);
                    gltfModel.defaultScene = 0;

                    // Save GLTF
                    tinygltf::TinyGLTF gltfLoader;
                    QString gltfName = QString("mesh_group_%1.gltf").arg(it.groupId);
                    const QString gltfPath = sdir.filePath(gltfName);
                    
                    // Save to file, no embedded images, no embedded buffers (separate bin), pretty print, text format (not binary .glb)
                    if (gltfLoader.WriteGltfSceneToFile(&gltfModel, gltfPath.toStdString(), false, false, true, false)) { 
                        res.written << gltfPath;
                        // Also track bin file? tinygltf writes it.
                        res.written << sdir.filePath(binName);
                        triangulated = true;
                    } else {
                        res.error += QString("Failed to write glTF file for group %1. ").arg(it.groupId);
                    }
                }
            }
        }
    }

    // TODO: materials, normals, colors as future work
    res.sceneDir = sceneDir;
    res.ok = true;
    res.validationReport = validateExportedScene(sceneDir, kinds);
    // Persist validation report alongside exports for external tooling
    QFile vr(sdir.filePath("validation_report.txt"));
    if (vr.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        vr.write(res.validationReport.toUtf8());
        vr.close();
        res.written << sdir.filePath("validation_report.txt");
    }
    return res;
}

QString validateExportedScene(const QString& sceneDir, int kinds) {
    QStringList lines;
    QDir d(sceneDir);
    if (!d.exists()) return "Scene dir does not exist";
    if (kinds & ExportDXF) {
        if (d.exists("scene.dxf")) lines << "DXF file: present";
        else lines << "DXF file: missing";
    }
    if (kinds & ExportJSON) {
        auto jsons = d.entryList(QStringList()<<"group_*.json", QDir::Files);
        lines << QString("JSON files: %1").arg(jsons.size());
        for (const auto& f : jsons) {
            QFile jf(d.filePath(f)); if (!jf.open(QIODevice::ReadOnly)) { lines << QString("- %1: open failed").arg(f); continue; }
            auto doc = QJsonDocument::fromJson(jf.readAll()); jf.close();
            if (!doc.isObject()) { lines << QString("- %1: not JSON object").arg(f); continue; }
            auto o = doc.object();
            bool ok1=o.contains("flat_pts"), ok2=o.contains("ring_counts");
            lines << QString("- %1: flat_pts=%2, ring_counts=%3").arg(f).arg(ok1?"ok":"miss").arg(ok2?"ok":"miss");
        }
    }
    if (kinds & ExportGLTF) {
        auto gltfs = d.entryList(QStringList()<<"mesh_group_*.gltf", QDir::Files);
        auto bins = d.entryList(QStringList()<<"mesh_group_*.bin", QDir::Files);
        lines << QString("glTF files: %1, bin files: %2").arg(gltfs.size()).arg(bins.size());
        for (const auto& f : gltfs) {
            QFile gf(d.filePath(f)); if (!gf.open(QIODevice::ReadOnly)) { lines << QString("- %1: open failed").arg(f); continue; }
            auto gdoc = QJsonDocument::fromJson(gf.readAll()); gf.close();
            if (!gdoc.isObject()) { lines << QString("- %1: invalid JSON").arg(f); continue; }
            auto o = gdoc.object();
            auto asset = o.value("asset").toObject();
            bool v20 = (asset.value("version").toString() == "2.0");
            auto buffers = o.value("buffers").toArray();
            auto bufferViews = o.value("bufferViews").toArray();
            auto accessors = o.value("accessors").toArray();
            auto meshes = o.value("meshes").toArray();
            QString status = v20 && !buffers.isEmpty() && !accessors.isEmpty() && !meshes.isEmpty() ? "ok" : "incomplete";
            // Check bin size matches
            QString binUri = buffers.at(0).toObject().value("uri").toString();
            int byteLen = buffers.at(0).toObject().value("byteLength").toInt();
            QFileInfo bi(d.filePath(binUri));
            bool binOk = bi.exists() && (bi.size() == byteLen);
            // Check POSITION accessor and indices accessor basic properties
            bool posOk=false, idxOk=false;
            if (!meshes.isEmpty()) {
                auto prims = meshes.at(0).toObject().value("primitives").toArray();
                if (!prims.isEmpty()) {
                    int posAcc = prims.at(0).toObject().value("attributes").toObject().value("POSITION").toInt(-1);
                    int idxAcc = prims.at(0).toObject().value("indices").toInt(-1);
                    if (posAcc>=0 && posAcc<accessors.size()) {
                        auto acc = accessors.at(posAcc).toObject();
                        posOk = (acc.value("componentType").toInt()==5126 /*FLOAT*/) && (acc.value("type").toString()=="VEC3") && (acc.value("count").toInt()>0);
                        int bv = acc.value("bufferView").toInt(-1); if (bv>=0 && bv<bufferViews.size()) {
                            int off = bufferViews.at(bv).toObject().value("byteOffset").toInt(); int len = bufferViews.at(bv).toObject().value("byteLength").toInt();
                            posOk = posOk && (off+len<=byteLen);
                        }
                    }
                    if (idxAcc>=0 && idxAcc<accessors.size()) {
                        auto acc = accessors.at(idxAcc).toObject();
                        idxOk = (acc.value("componentType").toInt()==5125 /*UNSIGNED_INT*/) && (acc.value("type").toString()=="SCALAR") && (acc.value("count").toInt()>0);
                        int bv = acc.value("bufferView").toInt(-1); if (bv>=0 && bv<bufferViews.size()) {
                            int off = bufferViews.at(bv).toObject().value("byteOffset").toInt(); int len = bufferViews.at(bv).toObject().value("byteLength").toInt();
                            idxOk = idxOk && (off+len<=byteLen);
                        }
                    }
                }
            }
            lines << QString("- %1: asset=%2, bin=%3, pos=%4, idx=%5")
                        .arg(f)
                        .arg(v20?"ok":"bad")
                        .arg(binOk?"ok":"bad")
                        .arg(posOk?"ok":"bad")
                        .arg(idxOk?"ok":"bad");
        }
    }
    return lines.join('\n');
}