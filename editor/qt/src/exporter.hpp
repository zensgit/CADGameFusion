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
};

// Simple exporter: writes per-group JSON (rings) and a single glTF stub (placeholder)
ExportResult exportScene(const QVector<ExportItem>& items, const QDir& baseDir);

