#pragma once

#include <QList>
#include <QVector>

#include "editor/qt/src/exporter.hpp"
#include "core/document.hpp"

namespace export_helpers {

// Build export items from Document, optionally filtering by group id (pass -1 for all).
QVector<ExportItem> collectExportItems(const core::Document& doc, int groupIdFilter = -1);

// Determine if the current selection belongs to a single group; returns group id or -1.
int selectionGroupId(const core::Document& doc, const QList<qulonglong>& selection);

}

