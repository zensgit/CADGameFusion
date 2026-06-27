#include <QtGui/QGuiApplication>
#include <QtGui/QImage>
#include <QtGui/QPainter>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>
#include <string>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "scene_renderer.hpp"

static core::Polyline makeSegment(double x0, double y0, double x1, double y1) {
    core::Polyline pl;
    pl.points = {{x0, y0}, {x1, y1}};
    return pl;
}

static core::Text makeText(double x, double y, const std::string& value) {
    core::Text t;
    t.pos = {x, y};
    t.height = 8.0;
    t.text = value;
    return t;
}

static void setMeta(core::Document& doc, core::EntityId id,
                    const char* suffix, const std::string& value) {
    const std::string key = "dxf.entity." +
        std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    assert(doc.set_meta_value(key, value));
}

static bool hasApproxColor(const QImage& img, unsigned int rgb, int tol = 12) {
    const int rr = (rgb >> 16) & 0xFF;
    const int gg = (rgb >> 8) & 0xFF;
    const int bb = rgb & 0xFF;
    for (int y = 0; y < img.height(); ++y) {
        for (int x = 0; x < img.width(); ++x) {
            const QColor c(img.pixelColor(x, y));
            const int dr = c.red() - rr;
            const int dg = c.green() - gg;
            const int db = c.blue() - bb;
            if (std::sqrt(double(dr * dr + dg * dg + db * db)) <= tol) {
                return true;
            }
        }
    }
    return false;
}

static int countInkPixels(const QImage& img) {
    int count = 0;
    for (int y = 0; y < img.height(); ++y) {
        for (int x = 0; x < img.width(); ++x) {
            const QColor c(img.pixelColor(x, y));
            if (c.alpha() > 0 && (c.red() > 24 || c.green() > 24 || c.blue() > 24)) {
                ++count;
            }
        }
    }
    return count;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QGuiApplication app(argc, argv);

    core::Document doc;

    const auto geometryId = doc.add_polyline(makeSegment(0, 0, 30, 0), "geometry");

    const auto hatchId = doc.add_polyline(makeSegment(0, 12, 30, 12), "hatch");
    assert(doc.set_entity_line_type(hatchId, "__HATCH_FILL__"));

    const auto dimensionId = doc.add_polyline(makeSegment(0, 24, 30, 24), "dimension");
    setMeta(doc, dimensionId, "source_type", "DIMENSION");

    const auto textId = doc.add_text(makeText(0, 40, "TEXT"), "STFangsong");

    const auto insertTextId = doc.add_text(makeText(0, 58, "TITLE"), "STFangsong");
    setMeta(doc, insertTextId, "source_type", "INSERT");
    setMeta(doc, insertTextId, "attribute_tag", "TITLE");

    assert(scene_render::semanticClassName(&doc, *doc.get_entity(geometryId)) == "geometry");
    assert(scene_render::semanticClassName(&doc, *doc.get_entity(hatchId)) == "hatch");
    assert(scene_render::semanticClassName(&doc, *doc.get_entity(dimensionId)) == "dimension");
    assert(scene_render::semanticClassName(&doc, *doc.get_entity(textId)) == "text");
    assert(scene_render::semanticClassName(&doc, *doc.get_entity(insertTextId)) == "insert_text");

    scene_render::View view;
    assert(scene_render::fitToContent(doc, QSize(500, 360), &view));
    scene_render::LinetypeTable linetypes;
    const QVector<scene_render::PolyVis> polylines = scene_render::buildPolyCache(doc);

    QImage mask(QSize(500, 360), QImage::Format_ARGB32_Premultiplied);
    mask.fill(QColor(0, 0, 0));
    QPainter pr(&mask);
    scene_render::renderScene(pr, &doc, polylines, view, linetypes, nullptr, true);
    pr.end();

    for (const auto& name : scene_render::semanticClassOrder()) {
        if (name == "other") continue;
        assert(hasApproxColor(mask, scene_render::semanticClassRgb(name)));
    }

    {
        core::Document cjkDoc;
        const std::string cjkFamily = scene_render::defaultTextFamily().toStdString();
        const auto textOnlyId = cjkDoc.add_text(makeText(0, 0, "罐体支腿"), cjkFamily);
        cjkDoc.set_entity_color(textOnlyId, 0xFFFFFFu);

        scene_render::View textView;
        textView.scale = 18.0;
        textView.pan = QPointF(40, 150);
        textView.lightBackground = false;
        scene_render::LinetypeTable textLinetypes;
        const QVector<scene_render::PolyVis> noPolylines = scene_render::buildPolyCache(cjkDoc);

        QImage colorText(QSize(360, 220), QImage::Format_ARGB32_Premultiplied);
        colorText.fill(QColor(0, 0, 0));
        QPainter colorPainter(&colorText);
        scene_render::renderScene(colorPainter, &cjkDoc, noPolylines, textView, textLinetypes, nullptr, false);
        colorPainter.end();

        QImage semanticText(QSize(360, 220), QImage::Format_ARGB32_Premultiplied);
        semanticText.fill(QColor(0, 0, 0));
        QPainter semanticPainter(&semanticText);
        scene_render::renderScene(semanticPainter, &cjkDoc, noPolylines, textView, textLinetypes, nullptr, true);
        semanticPainter.end();

        const int colorInk = countInkPixels(colorText);
        const int semanticInk = countInkPixels(semanticText);
        assert(semanticInk > 0);
        assert(colorInk > semanticInk + 8);
    }

    return 0;
}
