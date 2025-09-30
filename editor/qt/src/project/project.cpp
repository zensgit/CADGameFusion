#include "editor/qt/include/project/project.hpp"
#include "core/document.hpp"
#include "../canvas.hpp"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>

bool Project::save(const QString& path, const core::Document& /*doc*/, CanvasWidget* canvas) {
    m_meta.version = "0.2";
    m_meta.appVersion = "1.0.0";
    m_meta.modifiedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
    if (m_meta.createdAt.isEmpty()) m_meta.createdAt = m_meta.modifiedAt;

    QJsonObject root;
    QJsonObject meta{{"version", m_meta.version}, {"appVersion", m_meta.appVersion},
                    {"createdAt", m_meta.createdAt}, {"modifiedAt", m_meta.modifiedAt}};
    root.insert("meta", meta);

    // Save canvas polylines
    QJsonArray polylines;
    if (canvas) {
        for (const auto& pv : canvas->polylinesData()) {
            QJsonObject polyObj;
            QJsonArray points;
            for (const auto& pt : pv.pts) {
                points.append(QJsonObject{{"x", pt.x()}, {"y", pt.y()}});
            }
            polyObj.insert("points", points);
            polyObj.insert("color", pv.color.name());
            polyObj.insert("groupId", pv.groupId);
            polyObj.insert("visible", pv.visible);
            polylines.append(polyObj);
        }
    }

    QJsonObject doc;
    doc.insert("polylines", polylines);
    root.insert("document", doc);

    QFile f(path);
    if (!f.open(QIODevice::WriteOnly)) return false;
    f.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
    f.close();
    return true;
}

bool Project::load(const QString& path, core::Document& /*doc*/, CanvasWidget* canvas) {
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

    // Load canvas polylines
    if (canvas) {
        canvas->clear();
        auto doc = root.value("document").toObject();
        auto polylines = doc.value("polylines").toArray();

        for (const auto& value : polylines) {
            auto polyObj = value.toObject();
            QVector<QPointF> points;
            auto pointsArray = polyObj.value("points").toArray();
            for (const auto& ptValue : pointsArray) {
                auto pt = ptValue.toObject();
                points.append(QPointF(pt.value("x").toDouble(), pt.value("y").toDouble()));
            }

            QColor color(polyObj.value("color").toString());
            int groupId = polyObj.value("groupId").toInt();
            bool visible = polyObj.value("visible").toBool(true);

            // Add polyline with all properties
            CanvasWidget::PolyVis pv{points, color, groupId, visible};
            canvas->insertPolylineAt(canvas->polylineCount(), pv);
        }
    }

    return true;
}

