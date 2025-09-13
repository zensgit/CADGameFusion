#pragma once

#include <QString>
#include <QVector>
#include <QPointF>
#include <QDir>

struct ExportItem {
    int groupId;
    QVector<QVector<QPointF>> rings; // outer + holes as separate closed polylines
};

struct ExportResult {
    bool ok{false};
    QString sceneDir;
    QStringList written;
    QString error;
    QString validationReport;
};

enum ExportKind { ExportJSON = 1, ExportGLTF = 2 };

// Simple exporter: writes per-group JSON (rings) and/or a minimal glTF
ExportResult exportScene(const QVector<ExportItem>& items, const QDir& baseDir, int kinds, double unitScale);

// Validate exported scene directory (basic structural checks); returns human-readable report
QString validateExportedScene(const QString& sceneDir, int kinds);
