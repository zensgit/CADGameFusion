#include "exporter.hpp"

#include <QDateTime>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QVector3D>

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

ExportResult exportScene(const QVector<ExportItem>& items, const QDir& baseDir, int kinds, double unitScale,
                        const QJsonObject& meta, bool writeRingRoles, bool includeHolesGLTF) {
    ExportResult res;
    QDir dir(baseDir);
    const QString sceneDir = makeSceneDir(dir);
    if (!dir.mkpath(sceneDir)) { res.error = "Failed to create scene dir"; return res; }
    QDir sdir(sceneDir);

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

        // Also write minimal glTF + bin for this group (positions + indices)
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
        QByteArray bin;
        QString binName = QString("mesh_group_%1.bin").arg(it.groupId);
        QString gltfName = QString("mesh_group_%1.gltf").arg(it.groupId);
        const QString binPath = sdir.filePath(binName);
        const QString gltfPath = sdir.filePath(gltfName);

        bool triangulated = false;
        if ((kinds & ExportGLTF) && !flat.isEmpty() && !rc.isEmpty()) {
            if (core_triangulate_polygon_rings(flat.data(), rc.data(), rc.size(), nullptr, &idxCount) && idxCount > 0) {
                QVector<unsigned int> indices; indices.resize(idxCount);
                if (core_triangulate_polygon_rings(flat.data(), rc.data(), rc.size(), indices.data(), &idxCount)) {
                    // 3) Build binary: positions (float32 x,y,0), indices (uint32)
                    const int vcount = flat.size();
                    const int posBytes = vcount * 3 * sizeof(float);
                    const int idxBytes = idxCount * sizeof(uint32_t);
                    bin.resize(posBytes + idxBytes);
                    // positions
                    float* pf = reinterpret_cast<float*>(bin.data());
                    for (int i=0;i<vcount;i++) {
                        pf[i*3+0] = static_cast<float>(flat[i].x);
                        pf[i*3+1] = static_cast<float>(flat[i].y);
                        pf[i*3+2] = 0.0f;
                    }
                    // indices
                    uint32_t* pi = reinterpret_cast<uint32_t*>(bin.data() + posBytes);
                    for (int i=0;i<idxCount;i++) pi[i] = indices[i];

                    // 4) Write bin
                    QFile fb(binPath);
                    if (fb.open(QIODevice::WriteOnly)) { fb.write(bin); fb.close(); res.written << binPath; triangulated = true; }

                    // 5) Compute min/max for positions
                    float minx=std::numeric_limits<float>::max(), miny=minx, minz=0;
                    float maxx=std::numeric_limits<float>::lowest(), maxy=maxx, maxz=0;
                    for (int i=0;i<vcount;i++) { float x=pf[i*3+0], y=pf[i*3+1]; if (x<minx) minx=x; if (y<miny) miny=y; if (x>maxx) maxx=x; if (y>maxy) maxy=y; }

                    // 6) Write glTF JSON
                    QJsonObject gltf;
                    gltf.insert("asset", QJsonObject{{"version","2.0"}});
                    gltf.insert("buffers", QJsonArray{ QJsonObject{{"uri", binName}, {"byteLength", posBytes + idxBytes}} });
                    QJsonArray bufferViews;
                    bufferViews.append(QJsonObject{{"buffer",0},{"byteOffset",0},{"byteLength",posBytes},{"target",34962}}); // ARRAY_BUFFER
                    bufferViews.append(QJsonObject{{"buffer",0},{"byteOffset",posBytes},{"byteLength",idxBytes},{"target",34963}}); // ELEMENT_ARRAY_BUFFER
                    gltf.insert("bufferViews", bufferViews);
                    QJsonArray accessors;
                    accessors.append(QJsonObject{
                        {"bufferView",0},{"byteOffset",0},{"componentType",5126},{"count", vcount},
                        {"type","VEC3"},{"min", QJsonArray{minx,miny,minz}},{"max", QJsonArray{maxx,maxy,maxz}}
                    });
                    accessors.append(QJsonObject{
                        {"bufferView",1},{"byteOffset",0},{"componentType",5125},{"count", idxCount},{"type","SCALAR"}
                    });
                    gltf.insert("accessors", accessors);
                    QJsonArray primitives;
                    primitives.append(QJsonObject{{"attributes", QJsonObject{{"POSITION",0}}}, {"indices",1}, {"mode",4}}); // 4 = TRIANGLES
                    QJsonArray meshes;
                    meshes.append(QJsonObject{{"primitives", primitives}});
                    gltf.insert("meshes", meshes);
                    gltf.insert("nodes", QJsonArray{ QJsonObject{{"mesh",0}} });
                    gltf.insert("scenes", QJsonArray{ QJsonObject{{"nodes", QJsonArray{0}}} });
                    gltf.insert("scene", 0);
                    QJsonDocument gdoc(gltf);
                    QFile fg(gltfPath);
                    if (fg.open(QIODevice::WriteOnly)) { fg.write(gdoc.toJson()); fg.close(); res.written << gltfPath; }
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
