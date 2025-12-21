#include <QtCore/QCoreApplication>
#include <QtCore/QTemporaryDir>
#include <QtCore/QString>

#include <cassert>
#include <cmath>
#include <string>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "editor/qt/include/project/project.hpp"

static core::Polyline makeSquare(double size) {
    core::Polyline pl;
    pl.points = {{0, 0}, {size, 0}, {size, size}, {0, size}, {0, 0}};
    return pl;
}

static const core::Entity* findEntityByName(const core::Document& doc, const std::string& name) {
    for (const auto& entity : doc.entities()) {
        if (entity.name == name) {
            return &entity;
        }
    }
    return nullptr;
}

static int findLayerIdByName(const core::Document& doc, const std::string& name) {
    for (const auto& layer : doc.layers()) {
        if (layer.name == name) {
            return layer.id;
        }
    }
    return -1;
}

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);

    QTemporaryDir dir;
    assert(dir.isValid());
    const QString path = dir.filePath("roundtrip.cgf");

    core::Document doc;
    int layerId = doc.add_layer("Layer1", 0x112233u);
    doc.set_layer_visible(layerId, false);
    doc.set_layer_locked(layerId, true);
    doc.settings().unit_scale = 2.5;

    core::Polyline pl = makeSquare(1.0);
    core::EntityId id1 = doc.add_polyline(pl, "poly1", layerId);
    core::EntityId id2 = doc.add_polyline(pl, "poly2", 0);
    assert(id1 > 0);
    assert(id2 > 0);

    int groupId = doc.alloc_group_id();
    doc.set_entity_group_id(id1, groupId);
    doc.set_entity_visible(id1, false);
    doc.set_entity_color(id1, 0xABCDEFu);

    Project project;
    assert(project.save(path, doc, nullptr));

    core::Document loaded;
    Project project2;
    assert(project2.load(path, loaded, nullptr));

    assert(loaded.entities().size() == doc.entities().size());
    assert(loaded.layers().size() == doc.layers().size());
    assert(std::abs(loaded.settings().unit_scale - doc.settings().unit_scale) < 1e-9);

    assert(!loaded.layers().empty());
    assert(loaded.layers()[0].id == 0);
    assert(loaded.layers()[0].name == "0");

    int loadedLayerId = findLayerIdByName(loaded, "Layer1");
    assert(loadedLayerId > 0);
    const auto* loadedLayer = loaded.get_layer(loadedLayerId);
    assert(loadedLayer);
    assert(loadedLayer->color == 0x112233u);
    assert(!loadedLayer->visible);
    assert(loadedLayer->locked);

    const auto* e1 = findEntityByName(loaded, "poly1");
    assert(e1);
    assert(e1->layerId == loadedLayerId);
    assert(!e1->visible);
    assert(e1->groupId == groupId);
    assert(e1->color == 0xABCDEFu);

    const auto* e2 = findEntityByName(loaded, "poly2");
    assert(e2);
    assert(e2->layerId == 0);
    assert(e2->visible);
    assert(e2->groupId == -1);

    return 0;
}
