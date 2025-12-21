#include <QtCore/QCoreApplication>
#include <QtCore/QList>
#include <QtCore/QVector>

#include <cassert>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "editor/qt/include/export/export_helpers.hpp"

static core::Polyline makePoly(double size) {
    core::Polyline pl;
    pl.points = {{0, 0}, {size, 0}, {size, size}, {0, size}, {0, 0}};
    return pl;
}

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);

    core::Document doc;
    int layerRed = doc.add_layer("LayerRed", 0xFF0000u);
    auto id1 = doc.add_polyline(makePoly(1.0), "poly_red", layerRed);
    doc.set_entity_group_id(id1, 5);
    // entity color 0 => inherit from layer

    auto id2 = doc.add_polyline(makePoly(2.0), "poly_green", 0);
    doc.set_entity_group_id(id2, -1);
    doc.set_entity_color(id2, 0x00FF00u);

    QVector<ExportItem> allItems = export_helpers::collectExportItems(doc);
    assert(allItems.size() == 2);
    bool sawGroup5 = false;
    bool sawGroupUngrouped = false;
    for (const auto& item : allItems) {
        if (item.groupId == 5) {
            sawGroup5 = true;
            assert(item.rings.size() == 1);
            assert(item.layerName == "LayerRed");
            assert(item.layerColor == 0xFF0000u);
        } else {
            sawGroupUngrouped = true;
            assert(item.rings.size() == 1);
            assert(item.layerName == "0");
            assert(item.layerColor == 0xFFFFFFu);
        }
    }
    assert(sawGroup5 && sawGroupUngrouped);

    QVector<ExportItem> filtered = export_helpers::collectExportItems(doc, 5);
    assert(filtered.size() == 1);
    assert(filtered[0].groupId == 5);

    QList<qulonglong> selection;
    selection << static_cast<qulonglong>(id1);
    assert(export_helpers::selectionGroupId(doc, selection) == 5);
    selection << static_cast<qulonglong>(id2);
    assert(export_helpers::selectionGroupId(doc, selection) == -1);

    return 0;
}
