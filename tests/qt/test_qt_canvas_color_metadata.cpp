#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>

#include "canvas.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"

static core::Polyline makeSegment(double x0, double y0, double x1, double y1) {
    core::Polyline pl;
    pl.points = {
        {x0, y0},
        {x1, y1}
    };
    return pl;
}

static void setMeta(core::Document& doc, core::EntityId id, const char* suffix, const std::string& value) {
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    assert(doc.set_meta_value(key, value));
}

static CanvasWidget::PolylineState findState(const QVector<CanvasWidget::PolylineState>& states, EntityId id) {
    for (const auto& state : states) {
        if (state.entityId == id) return state;
    }
    assert(false && "missing polyline state");
    return {};
}

static unsigned int rgbOf(const QColor& color) {
    return static_cast<unsigned int>(color.rgb()) & 0xFFFFFFu;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    CanvasWidget canvas;
    canvas.setDocument(&doc);

    const unsigned int layerColor = 0x0033CCu;
    assert(doc.set_layer_color(0, layerColor));

    const auto byLayerId = doc.add_polyline(makeSegment(0, 0, 1, 0), "bylayer");
    setMeta(doc, byLayerId, "color_source", "BYLAYER");

    const auto indexId = doc.add_polyline(makeSegment(2, 0, 3, 0), "index");
    setMeta(doc, indexId, "color_source", "INDEX");
    setMeta(doc, indexId, "color_aci", "2");

    const auto trueId = doc.add_polyline(makeSegment(4, 0, 5, 0), "truecolor");
    assert(doc.set_entity_color(trueId, 0x112233u));
    setMeta(doc, trueId, "color_source", "TRUECOLOR");

    const auto byBlockId = doc.add_polyline(makeSegment(6, 0, 7, 0), "byblock");
    setMeta(doc, byBlockId, "color_source", "BYBLOCK");
    setMeta(doc, byBlockId, "color_aci", "1");

    canvas.reloadFromDocument();
    const auto states = CanvasTestAccess::polylineStates(canvas);

    const auto byLayer = findState(states, byLayerId);
    assert(rgbOf(byLayer.color) == layerColor);

    const auto indexState = findState(states, indexId);
    assert(rgbOf(indexState.color) == 0xFFFF00u);

    const auto trueState = findState(states, trueId);
    assert(rgbOf(trueState.color) == 0x112233u);

    const auto byBlock = findState(states, byBlockId);
    assert(rgbOf(byBlock.color) == 0xFF0000u);

    return 0;
}
