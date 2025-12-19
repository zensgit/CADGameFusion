#include "editor/qt/include/project/project.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "../canvas.hpp"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>

bool Project::save(const QString& path, const core::Document& doc, CanvasWidget* /*canvas*/) {
    // PR6: Serialize Document as single source of truth
    m_meta.version = "0.3"; // Bumped version for Document-centric format
    m_meta.appVersion = "1.0.0";
    m_meta.modifiedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
    if (m_meta.createdAt.isEmpty()) m_meta.createdAt = m_meta.modifiedAt;

    QJsonObject root;
    QJsonObject meta{{"version", m_meta.version}, {"appVersion", m_meta.appVersion},
                    {"createdAt", m_meta.createdAt}, {"modifiedAt", m_meta.modifiedAt}};
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
        layersJson.append(layerObj);
    }

    // Serialize entities from Document (single source of truth)
    QJsonArray entitiesJson;
    for (const auto& e : doc.entities()) {
        if (e.type != core::EntityType::Polyline) continue;
        if (!e.payload) continue;

        const auto* pl = static_cast<const core::Polyline*>(e.payload.get());
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

    QJsonObject docJson;
    docJson.insert("layers", layersJson);
    docJson.insert("entities", entitiesJson);
    docJson.insert("settings", settingsJson);
    root.insert("document", docJson);

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
    m_meta.appVersion = meta.value("appVersion").toString();
    m_meta.createdAt = meta.value("createdAt").toString();
    m_meta.modifiedAt = meta.value("modifiedAt").toString();

    // Check version for format compatibility
    const QString version = m_meta.version;

    auto docJson = root.value("document").toObject();

    // Load layers (v0.3+)
    if (version >= "0.3") {
        auto layersJson = docJson.value("layers").toArray();
        // Skip default layer (id=0), it's created by Document constructor
        for (const auto& val : layersJson) {
            auto layerObj = val.toObject();
            int id = layerObj.value("id").toInt();
            if (id == 0) continue; // Default layer already exists

            QString name = layerObj.value("name").toString();
            uint32_t color = static_cast<uint32_t>(layerObj.value("color").toInteger(0xFFFFFF));
            int newId = doc.add_layer(name.toStdString(), color);

            // Set visibility and locked state
            auto* layer = doc.get_layer(newId);
            if (layer) {
                layer->visible = layerObj.value("visible").toBool(true);
                layer->locked = layerObj.value("locked").toBool(false);
            }
        }
    }

    // Load entities (v0.3+ Document-centric format)
    if (version >= "0.3") {
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

                core::EntityId eid = doc.add_polyline(pl, name.toStdString(), layerId);

                // Apply entity metadata (PR4)
                doc.set_entity_visible(eid, entityObj.value("visible").toBool(true));
                doc.set_entity_group_id(eid, entityObj.value("groupId").toInt(-1));
                doc.set_entity_color(eid, static_cast<uint32_t>(entityObj.value("color").toInteger(0)));
            }
        }

        // Load settings
        auto settingsJson = docJson.value("settings").toObject();
        doc.settings().unit_scale = settingsJson.value("unitScale").toDouble(1.0);
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
        canvas->reloadFromDocument();
    }

    return true;
}

