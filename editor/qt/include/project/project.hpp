#pragma once

#include <QString>
#include <QVector>
#include <QPointF>
#include <QColor>

namespace core { class Document; }
class CanvasWidget;

struct ProjectMeta {
    QString version;
    int schemaVersion{-1};
    QString appVersion;
    QString createdAt;
    QString modifiedAt;
};

class Project {
public:
    static constexpr int kSchemaVersion = 1;
    bool save(const QString& path, const core::Document& doc, CanvasWidget* canvas = nullptr);
    bool load(const QString& path, core::Document& doc, CanvasWidget* canvas = nullptr);
    ProjectMeta meta() const { return m_meta; }
private:
    ProjectMeta m_meta;
};
