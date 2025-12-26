#include "editor/qt/include/project/project.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "../canvas.hpp"
#include "editor/qt/include/snap/snap_settings.hpp"
#include <QFile>
#include <QHash>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>

namespace {
int resolve_schema_version(int schema_version, const QString& version) {
    if (schema_version >= 0) {
        return schema_version;
    }
    bool ok = false;
    const double parsed = version.toDouble(&ok);
    if (ok && parsed >= 0.3) {
        return Project::kSchemaVersion;
    }
    return 0;
}
} // namespace

bool Project::save(const QString& path, const core::Document& doc, CanvasWidget* canvas) {
    // PR6: Serialize Document as single source of truth
    m_meta.version = "0.4"; // Bumped version for schemaVersion field
    m_meta.schemaVersion = Project::kSchemaVersion;
    m_meta.appVersion = "1.0.0";
    m_meta.modifiedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
    if (m_meta.createdAt.isEmpty()) m_meta.createdAt = m_meta.modifiedAt;

    QJsonObject root;
    QJsonObject meta{{"version", m_meta.version},
                     {"schemaVersion", m_meta.schemaVersion},
                     {"appVersion", m_meta.appVersion},
                     {"createdAt", m_meta.createdAt},
                     {"modifiedAt", m_meta.modifiedAt}};
    root.insert("meta", meta);

    // Serialize layers
    QJsonArray layersJson;
    for (const auto& layer : doc.layers()) {
        QJsonObject layerObj;
        layerObj.insert("id", layer.id);
        layerObj.insert("name", QString::fromStdString(layer.name));
        layerObj.insert("color", static_cast<qint64>(layer.color));
        layerObj.insert("visible", layer.visible);
        layerObj.insert("locked", layer.locked);
        layerObj.insert("printable", layer.printable);
        layerObj.insert("frozen", layer.frozen);
        layerObj.insert("construction", layer.construction);
        layersJson.append(layerObj);
    }

    // Serialize entities from Document (single source of truth)
    QJsonArray entitiesJson;
    for (const auto& e : doc.entities()) {
        if (e.type != core::EntityType::Polyline) continue;
        const auto* pl = std::get_if<core::Polyline>(&e.payload);
        if (!pl || pl->points.empty()) continue;

        QJsonObject entityObj;
        entityObj.insert("id", static_cast<qint64>(e.id));
        entityObj.insert("type", "polyline");
        entityObj.insert("name", QString::fromStdString(e.name));
        entityObj.insert("layerId", e.layerId);
        entityObj.insert("visible", e.visible);
        entityObj.insert("groupId", e.groupId);
        entityObj.insert("color", static_cast<qint64>(e.color));

        QJsonArray points;
        for (const auto& pt : pl->points) {
            points.append(QJsonObject{{"x", pt.x}, {"y", pt.y}});
        }
        entityObj.insert("points", points);

        entitiesJson.append(entityObj);
    }

    // Serialize settings
    QJsonObject settingsJson;
    settingsJson.insert("unitScale", doc.settings().unit_scale);

    // Serialize document metadata
    QJsonObject docMetaJson;
    const auto& docMeta = doc.metadata();
    docMetaJson.insert("label", QString::fromStdString(docMeta.label));
    docMetaJson.insert("author", QString::fromStdString(docMeta.author));
    docMetaJson.insert("company", QString::fromStdString(docMeta.company));
    docMetaJson.insert("comment", QString::fromStdString(docMeta.comment));
    docMetaJson.insert("createdAt", QString::fromStdString(docMeta.created_at));
    docMetaJson.insert("modifiedAt", QString::fromStdString(docMeta.modified_at));
    docMetaJson.insert("unitName", QString::fromStdString(docMeta.unit_name));
    QJsonObject metaMap;
    for (const auto& kv : docMeta.meta) {
        metaMap.insert(QString::fromStdString(kv.first), QString::fromStdString(kv.second));
    }
    docMetaJson.insert("meta", metaMap);

    QJsonObject docJson;
    docJson.insert("layers", layersJson);
    docJson.insert("entities", entitiesJson);
    docJson.insert("settings", settingsJson);
    docJson.insert("metadata", docMetaJson);
    root.insert("document", docJson);

    if (canvas) {
        auto* snap = canvas->snapSettings();
        if (snap) {
            QJsonObject snapJson;
            snapJson.insert("endpoints", snap->snapEndpoints());
            snapJson.insert("midpoints", snap->snapMidpoints());
            snapJson.insert("grid", snap->snapGrid());
            snapJson.insert("radiusPx", snap->snapRadiusPixels());
            snapJson.insert("gridPixelSpacing", snap->gridPixelSpacing());
            QJsonObject editorJson;
            editorJson.insert("snap", snapJson);
            root.insert("editor", editorJson);
        }
    }

    QFile f(path);
    if (!f.open(QIODevice::WriteOnly)) return false;
    f.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
    f.close();
    return true;
}

bool Project::load(const QString& path, core::Document& doc, CanvasWidget* canvas) {
    // PR6: Load Document as single source of truth, then project to Canvas
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return false;
    auto docj = QJsonDocument::fromJson(f.readAll());
    f.close();

    if (!docj.isObject()) return false;
    auto root = docj.object();

    // Load metadata
    auto meta = root.value("meta").toObject();
    m_meta.version = meta.value("version").toString();
    m_meta.schemaVersion = meta.value("schemaVersion").toInt(-1);
    m_meta.appVersion = meta.value("appVersion").toString();
    m_meta.createdAt = meta.value("createdAt").toString();
    m_meta.modifiedAt = meta.value("modifiedAt").toString();

    // Reset document only after successful parse
    core::DocumentChangeGuard guard(doc);
    doc.clear();

    // Check version for format compatibility
    const int schemaVersion = resolve_schema_version(m_meta.schemaVersion, m_meta.version);
    if (schemaVersion > Project::kSchemaVersion) {
        return false;
    }

    auto docJson = root.value("document").toObject();
    QHash<int, int> layerIdMap;
    layerIdMap.insert(0, 0);

    // Load layers (v0.3+)
    if (schemaVersion >= Project::kSchemaVersion) {
        auto layersJson = docJson.value("layers").toArray();
        for (const auto& val : layersJson) {
            auto layerObj = val.toObject();
            int srcId = layerObj.value("id").toInt();

            QString name = layerObj.value("name").toString();
            uint32_t color = static_cast<uint32_t>(layerObj.value("color").toInteger(0xFFFFFF));
            bool visible = layerObj.value("visible").toBool(true);
            bool locked = layerObj.value("locked").toBool(false);
            bool printable = layerObj.value("printable").toBool(true);
            bool frozen = layerObj.value("frozen").toBool(false);
            bool construction = layerObj.value("construction").toBool(false);

            if (srcId == 0) {
                auto* layer0 = doc.get_layer(0);
                if (layer0) {
                    layer0->name = name.toStdString();
                    doc.set_layer_color(0, color);
                    doc.set_layer_visible(0, visible);
                    doc.set_layer_locked(0, locked);
                    doc.set_layer_printable(0, printable);
                    doc.set_layer_frozen(0, frozen);
                    doc.set_layer_construction(0, construction);
                }
                layerIdMap.insert(0, 0);
                continue;
            }

            int newId = doc.add_layer(name.toStdString(), color);
            layerIdMap.insert(srcId, newId);
            doc.set_layer_visible(newId, visible);
            doc.set_layer_locked(newId, locked);
            doc.set_layer_printable(newId, printable);
            doc.set_layer_frozen(newId, frozen);
            doc.set_layer_construction(newId, construction);
        }
    }

    // Load entities (v0.3+ Document-centric format)
    if (schemaVersion >= Project::kSchemaVersion) {
        auto entitiesJson = docJson.value("entities").toArray();
        for (const auto& val : entitiesJson) {
            auto entityObj = val.toObject();
            QString type = entityObj.value("type").toString();

            if (type == "polyline") {
                auto pointsArray = entityObj.value("points").toArray();
                core::Polyline pl;
                pl.points.reserve(static_cast<size_t>(pointsArray.size()));
                for (const auto& ptVal : pointsArray) {
                    auto pt = ptVal.toObject();
                    pl.points.push_back(core::Vec2{pt.value("x").toDouble(), pt.value("y").toDouble()});
                }

                QString name = entityObj.value("name").toString();
                int layerId = entityObj.value("layerId").toInt(0);
                if (layerIdMap.contains(layerId)) {
                    layerId = layerIdMap.value(layerId);
                } else {
                    layerId = 0;
                }

                core::EntityId eid = doc.add_polyline(pl, name.toStdString(), layerId);

                // Apply entity metadata (PR4)
                doc.set_entity_visible(eid, entityObj.value("visible").toBool(true));
                doc.set_entity_group_id(eid, entityObj.value("groupId").toInt(-1));
                doc.set_entity_color(eid, static_cast<uint32_t>(entityObj.value("color").toInteger(0)));
            }
        }

        // Load settings
        auto settingsJson = docJson.value("settings").toObject();
        doc.set_unit_scale(settingsJson.value("unitScale").toDouble(1.0));

        // Load document metadata
        auto docMetaJson = docJson.value("metadata").toObject();
        if (!docMetaJson.isEmpty()) {
            doc.set_label(docMetaJson.value("label").toString().toStdString());
            doc.set_author(docMetaJson.value("author").toString().toStdString());
            doc.set_company(docMetaJson.value("company").toString().toStdString());
            doc.set_comment(docMetaJson.value("comment").toString().toStdString());
            doc.set_created_at(docMetaJson.value("createdAt").toString().toStdString());
            doc.set_modified_at(docMetaJson.value("modifiedAt").toString().toStdString());
            doc.set_unit_name(docMetaJson.value("unitName").toString().toStdString());
            auto metaMap = docMetaJson.value("meta").toObject();
            for (auto it = metaMap.begin(); it != metaMap.end(); ++it) {
                doc.set_meta_value(it.key().toStdString(), it.value().toString().toStdString());
            }
        }
    }
    // Legacy format (v0.2 and earlier): load from polylines array
    else {
        auto polylinesJson = docJson.value("polylines").toArray();
        for (const auto& val : polylinesJson) {
            auto polyObj = val.toObject();
            auto pointsArray = polyObj.value("points").toArray();

            core::Polyline pl;
            pl.points.reserve(static_cast<size_t>(pointsArray.size()));
            for (const auto& ptVal : pointsArray) {
                auto pt = ptVal.toObject();
                pl.points.push_back(core::Vec2{pt.value("x").toDouble(), pt.value("y").toDouble()});
            }

            core::EntityId eid = doc.add_polyline(pl);

            // Apply legacy metadata
            doc.set_entity_visible(eid, polyObj.value("visible").toBool(true));
            doc.set_entity_group_id(eid, polyObj.value("groupId").toInt(-1));

            // Legacy color format was hex string like "#RRGGBB"
            QString colorStr = polyObj.value("color").toString();
            if (colorStr.startsWith('#') && colorStr.length() == 7) {
                QColor c(colorStr);
                uint32_t colorVal = static_cast<uint32_t>((c.red() << 16) | (c.green() << 8) | c.blue());
                doc.set_entity_color(eid, colorVal);
            }
        }
    }

    // PR5: Project Document state to Canvas
    if (canvas) {
        canvas->setDocument(&doc);
    }

    if (canvas) {
        auto* snap = canvas->snapSettings();
        if (snap) {
            const auto editorJson = root.value("editor").toObject();
            const auto snapJson = editorJson.value("snap").toObject();
            if (!snapJson.isEmpty()) {
                snap->setSnapEndpoints(snapJson.value("endpoints").toBool(snap->snapEndpoints()));
                snap->setSnapMidpoints(snapJson.value("midpoints").toBool(snap->snapMidpoints()));
                snap->setSnapGrid(snapJson.value("grid").toBool(snap->snapGrid()));
                snap->setSnapRadiusPixels(snapJson.value("radiusPx").toDouble(snap->snapRadiusPixels()));
                snap->setGridPixelSpacing(snapJson.value("gridPixelSpacing").toDouble(snap->gridPixelSpacing()));
            }
        }
    }

    return true;
}
