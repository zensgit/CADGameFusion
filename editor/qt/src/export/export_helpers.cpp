#include "editor/qt/include/export/export_helpers.hpp"

#include <QMap>
#include <QPointF>

#include "core/geometry2d.hpp"

namespace export_helpers {

namespace {
uint32_t effectiveEntityColor(const core::Document& doc, const core::Entity& e) {
    if (e.color != 0) return e.color;
    const auto* layer = doc.get_layer(e.layerId);
    return layer ? layer->color : 0xDCDCE6u;
}

void appendExportEntity(const core::Document& doc,
                        const core::Entity& entity,
                        QMap<int, ExportItem>& groupMap) {
    if (entity.type != core::EntityType::Polyline || !entity.payload) return;
    const auto* pl = static_cast<const core::Polyline*>(entity.payload.get());
    if (!pl || pl->points.size() < 2) return;

    ExportItem& item = groupMap[entity.groupId];
    item.groupId = entity.groupId;

    QVector<QPointF> ring;
    ring.reserve(static_cast<int>(pl->points.size()));
    for (const auto& pt : pl->points) ring.append(QPointF(pt.x, pt.y));
    item.rings.append(ring);

    if (item.layerName.isEmpty()) {
        const auto* layer = doc.get_layer(entity.layerId);
        if (layer) {
            item.layerName = QString::fromStdString(layer->name);
            item.layerColor = layer->color;
        } else {
            item.layerName = QStringLiteral("0");
            item.layerColor = 0xFFFFFFu;
        }
    }
}
} // namespace

QVector<ExportItem> collectExportItems(const core::Document& doc, int groupIdFilter) {
    QMap<int, ExportItem> groupMap;
    for (const auto& entity : doc.entities()) {
        if (groupIdFilter != -1 && entity.groupId != groupIdFilter) continue;
        appendExportEntity(doc, entity, groupMap);
    }
    QVector<ExportItem> items;
    items.reserve(groupMap.size());
    for (auto it = groupMap.begin(); it != groupMap.end(); ++it) {
        items.append(it.value());
    }
    return items;
}

int selectionGroupId(const core::Document& doc, const QList<qulonglong>& selection) {
    if (selection.isEmpty()) return -1;
    const auto* first = doc.get_entity(static_cast<core::EntityId>(selection.front()));
    if (!first || first->groupId == -1) return -1;
    const int gid = first->groupId;
    for (int i = 1; i < selection.size(); ++i) {
        const auto* entity = doc.get_entity(static_cast<core::EntityId>(selection[i]));
        if (!entity || entity->groupId != gid) return -1;
    }
    return gid;
}

} // namespace export_helpers
