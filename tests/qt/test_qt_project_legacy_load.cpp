#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QTemporaryDir>
#include <QtCore/QString>
#include <QtCore/QFile>
#include <QtCore/QJsonArray>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>

#include <cassert>
#include <cmath>

#include "core/document.hpp"
#include "canvas.hpp"
#include "editor/qt/include/project/project.hpp"
#include "snap/snap_settings.hpp"

static QJsonArray makePoints(std::initializer_list<QPointF> pts) {
    QJsonArray arr;
    for (const auto& pt : pts) {
        arr.append(QJsonObject{{"x", pt.x()}, {"y", pt.y()}});
    }
    return arr;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    QTemporaryDir dir;
    assert(dir.isValid());
    const QString path = dir.filePath("legacy.cgf");

    QJsonObject meta{
        {"version", "0.2"},
        {"appVersion", "1.0.0"},
        {"createdAt", "2024-01-01T00:00:00Z"},
        {"modifiedAt", "2024-01-02T00:00:00Z"}
    };

    QJsonArray polylines;
    QJsonObject poly1;
    poly1.insert("points", makePoints({{0, 0}, {1, 0}, {1, 1}, {0, 0}}));
    poly1.insert("visible", false);
    poly1.insert("groupId", 5);
    poly1.insert("color", "#112233");
    polylines.append(poly1);

    QJsonObject poly2;
    poly2.insert("points", makePoints({{2, 2}, {3, 2}, {3, 3}, {2, 2}}));
    poly2.insert("visible", true);
    poly2.insert("groupId", 7);
    poly2.insert("color", "#AABBCC");
    polylines.append(poly2);

    QJsonObject docJson;
    docJson.insert("polylines", polylines);

    QJsonObject root;
    root.insert("meta", meta);
    root.insert("document", docJson);

    QFile f(path);
    if (!f.open(QIODevice::WriteOnly)) {
        return 1;
    }
    const qint64 written = f.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
    f.close();
    if (written <= 0) {
        return 1;
    }

    core::Document loaded;
    CanvasWidget canvas;
    SnapSettings snap;
    canvas.setSnapSettings(&snap);
    canvas.setDocument(&loaded);

    Project project;
    assert(project.load(path, loaded, &canvas));

    assert(loaded.entities().size() == 2);
    assert(loaded.layers().size() >= 1);
    assert(loaded.layers()[0].id == 0);

    const auto& e1 = loaded.entities()[0];
    assert(!e1.visible);
    assert(e1.groupId == 5);
    assert(e1.color == 0x112233u);
    assert(e1.layerId == 0);

    const auto& e2 = loaded.entities()[1];
    assert(e2.visible);
    assert(e2.groupId == 7);
    assert(e2.color == 0xAABBCCu);
    assert(e2.layerId == 0);

    return 0;
}
