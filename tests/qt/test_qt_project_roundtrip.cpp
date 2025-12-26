#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QTemporaryDir>
#include <QtCore/QString>
#include <QtCore/QFile>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>

#include <cassert>
#include <cmath>
#include <cstdio>
#include <string>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"
#include "editor/qt/include/project/project.hpp"
#include "snap/snap_settings.hpp"

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
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    QTemporaryDir dir;
    assert(dir.isValid());
    const QString path = dir.filePath("roundtrip.cgf");

    core::Document doc;
    CanvasWidget canvas;
    SnapSettings snap;
    canvas.setSnapSettings(&snap);
    canvas.setDocument(&doc);
    auto* defaultLayer = doc.get_layer(0);
    assert(defaultLayer);
    defaultLayer->name = "Default";
    doc.set_layer_color(0, 0x445566u);
    doc.set_layer_visible(0, false);
    doc.set_layer_locked(0, true);
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
    int groupId2 = doc.alloc_group_id();
    doc.set_entity_group_id(id2, groupId2);
    doc.set_entity_visible(id2, true);
    doc.set_entity_color(id2, 0x102030u);

    snap.setSnapEndpoints(false);
    snap.setSnapMidpoints(true);
    snap.setSnapGrid(true);
    snap.setSnapRadiusPixels(18.0);
    snap.setGridPixelSpacing(40.0);

    Project project;
    if (!project.save(path, doc, &canvas)) {
        std::fprintf(stderr, "Failed to save project to %s\n", path.toUtf8().constData());
        return 1;
    }

    QFile saved(path);
    if (!saved.open(QIODevice::ReadOnly)) {
        std::fprintf(stderr, "Failed to open saved project %s\n", path.toUtf8().constData());
        return 1;
    }
    const auto savedDoc = QJsonDocument::fromJson(saved.readAll());
    saved.close();
    if (!savedDoc.isObject()) {
        std::fprintf(stderr, "Saved project JSON is not an object\n");
        return 1;
    }
    const auto savedMeta = savedDoc.object().value("meta").toObject();
    const int schemaVersion = savedMeta.value("schemaVersion").toInt(-1);
    if (schemaVersion != Project::kSchemaVersion) {
        std::fprintf(stderr, "Unexpected schemaVersion %d\n", schemaVersion);
        return 1;
    }

    core::Document loaded;
    CanvasWidget canvas2;
    SnapSettings snap2;
    canvas2.setSnapSettings(&snap2);
    canvas2.setDocument(&loaded);
    Project project2;
    if (!project2.load(path, loaded, &canvas2)) {
        std::fprintf(stderr, "Failed to load project %s\n", path.toUtf8().constData());
        return 1;
    }

    assert(loaded.entities().size() == doc.entities().size());
    assert(loaded.layers().size() == doc.layers().size());
    assert(std::abs(loaded.settings().unit_scale - doc.settings().unit_scale) < 1e-9);

    assert(!loaded.layers().empty());
    assert(loaded.layers()[0].id == 0);
    assert(loaded.layers()[0].name == "Default");
    assert(loaded.layers()[0].color == 0x445566u);
    assert(!loaded.layers()[0].visible);
    assert(loaded.layers()[0].locked);

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
    assert(e2->groupId == groupId2);
    assert(e2->color == 0x102030u);

    assert(!snap2.snapEndpoints());
    assert(snap2.snapMidpoints());
    assert(snap2.snapGrid());
    assert(std::abs(snap2.snapRadiusPixels() - 18.0) < 1e-6);
    assert(std::abs(snap2.gridPixelSpacing() - 40.0) < 1e-6);

    return 0;
}
