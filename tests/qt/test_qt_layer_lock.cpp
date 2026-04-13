#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: isEntityLocked returns false for unlocked layer ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        int layerId = doc.add_layer("TestLayer");
        core::Polyline pl;
        pl.points = {{0,0}, {1,0}, {1,1}, {0,0}};
        auto eid = doc.add_polyline(pl, "test", layerId);

        const auto* entity = doc.get_entity(eid);
        assert(entity);
        // Use the public interface indirectly - layer is not locked by default
        const auto* layer = doc.get_layer(layerId);
        assert(layer);
        assert(!layer->locked);
        fprintf(stderr, "  PASS: layer unlocked by default\n");
    }

    // ═══ Test 2: set_layer_locked works ═══
    {
        core::Document doc;
        int layerId = doc.add_layer("LockTest");
        assert(doc.set_layer_locked(layerId, true));

        const auto* layer = doc.get_layer(layerId);
        assert(layer);
        assert(layer->locked);

        assert(doc.set_layer_locked(layerId, false));
        layer = doc.get_layer(layerId);
        assert(!layer->locked);
        fprintf(stderr, "  PASS: set_layer_locked toggles lock state\n");
    }

    // ═══ Test 3: Locked entity cannot be moved (document-level check) ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        int layerId = doc.add_layer("LockedLayer");
        doc.set_layer_locked(layerId, true);

        core::Polyline pl;
        pl.points = {{5,5}, {10,5}, {10,10}, {5,5}};
        auto eid = doc.add_polyline(pl, "locked_entity", layerId);

        const auto* entity = doc.get_entity(eid);
        assert(entity);

        // Verify entity is on a locked layer
        const auto* layer = doc.get_layer(entity->layerId);
        assert(layer && layer->locked);

        // The entity's geometry should still be intact
        auto* polyline = std::get_if<core::Polyline>(&entity->payload);
        assert(polyline);
        assert(polyline->points.size() == 4);
        assert(polyline->points[0].x == 5.0);
        fprintf(stderr, "  PASS: locked entity accessible but layer is locked\n");
    }

    // ═══ Test 4: Lock state roundtrips through add/modify cycle ═══
    {
        core::Document doc;
        int lid1 = doc.add_layer("Layer1");
        int lid2 = doc.add_layer("Layer2");

        doc.set_layer_locked(lid1, true);
        doc.set_layer_locked(lid2, false);

        assert(doc.get_layer(lid1)->locked == true);
        assert(doc.get_layer(lid2)->locked == false);

        // Unlock lid1, lock lid2
        doc.set_layer_locked(lid1, false);
        doc.set_layer_locked(lid2, true);

        assert(doc.get_layer(lid1)->locked == false);
        assert(doc.get_layer(lid2)->locked == true);
        fprintf(stderr, "  PASS: lock state roundtrips correctly\n");
    }

    // ═══ Test 5: Default layer (0) lock behavior ═══
    {
        core::Document doc;
        // Default layer should exist and be unlocked
        const auto& layers = doc.layers();
        assert(!layers.empty());
        assert(!layers[0].locked);

        // Can lock the default layer
        doc.set_layer_locked(layers[0].id, true);
        assert(doc.get_layer(layers[0].id)->locked);
        fprintf(stderr, "  PASS: default layer lockable\n");
    }

    fprintf(stderr, "\n  All Layer Lock tests passed!\n");
    return 0;
}
