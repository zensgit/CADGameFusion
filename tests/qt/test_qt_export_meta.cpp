#include <QtCore/QCoreApplication>
#include <QtCore/QDir>
#include <QtCore/QFile>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QJsonArray>
#include <QtCore/QStringList>
#include <QtCore/QVector>
#include <QtCore/QPointF>
#include <cassert>
#include <iostream>

#include "../../editor/qt/src/exporter.hpp"

static QJsonObject makeMeta(double unitScale, bool useDocUnit) {
    QJsonObject meta;
    meta.insert("joinType", 0);
    meta.insert("miterLimit", 2.0);
    meta.insert("unitScale", unitScale);
    meta.insert("useDocUnit", useDocUnit);
    QJsonObject norm;
    norm.insert("orientation", true);
    norm.insert("start", true);
#ifdef CADGF_SORT_RINGS
    norm.insert("sortRings", true);
#else
    norm.insert("sortRings", false);
#endif
    meta.insert("normalize", norm);
    return meta;
}

static QJsonObject loadGroupJson(const QString& sceneDir, int groupId) {
    QString path = QDir(sceneDir).filePath(QString("group_%1.json").arg(groupId));
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) {
        std::cerr << "Open failed: " << path.toStdString() << std::endl;
        assert(false);
    }
    auto doc = QJsonDocument::fromJson(f.readAll());
    f.close();
    assert(doc.isObject());
    return doc.object();
}

int main(int argc, char** argv) {
    // No QApplication needed; but ensure Qt is initialized for path handling
    QCoreApplication app(argc, argv);

    // Temp base dir
    QDir base(QDir::current().filePath("qt_meta_test_tmp"));
    if (base.exists()) base.removeRecursively();
    QDir().mkpath(base.path());

    // Prepare a simple square ring
    ExportItem it; it.groupId = 0;
    QVector<QPointF> ring; ring << QPointF(0,0) << QPointF(1,0) << QPointF(1,1) << QPointF(0,1);
    it.rings = QVector<QVector<QPointF>>{ ring };
    QVector<ExportItem> items{ it };

    // Case 1: use document unit scale (unitScale param ignored by consumers)
    {
        double unitScale = 1.0;
        bool useDocUnit = true;
        QJsonObject meta = makeMeta(unitScale, useDocUnit);
        ExportResult res = exportScene(items, base, ExportJSON, unitScale, meta, true, true);
        assert(res.ok);
        auto obj = loadGroupJson(res.sceneDir, 0);
        assert(obj.contains("meta"));
        auto m = obj.value("meta").toObject();
        assert(m.value("unitScale").toDouble() == unitScale);
        assert(m.value("useDocUnit").toBool() == useDocUnit);
        auto norm = m.value("normalize").toObject();
        assert(norm.value("orientation").toBool() == true);
        assert(norm.value("start").toBool() == true);
#ifdef CADGF_SORT_RINGS
        assert(norm.value("sortRings").toBool() == true);
#else
        assert(norm.value("sortRings").toBool() == false);
#endif
        std::cout << "Case 1 passed" << std::endl;
    }

    // Case 2: custom unit scale, not using document units
    {
        double unitScale = 0.001;
        bool useDocUnit = false;
        QJsonObject meta = makeMeta(unitScale, useDocUnit);
        ExportResult res = exportScene(items, base, ExportJSON, unitScale, meta, true, true);
        assert(res.ok);
        auto obj = loadGroupJson(res.sceneDir, 0);
        assert(obj.contains("meta"));
        auto m = obj.value("meta").toObject();
        // numeric equality with tolerance (Qt stores double precisely here)
        assert(std::abs(m.value("unitScale").toDouble() - unitScale) < 1e-12);
        assert(m.value("useDocUnit").toBool() == useDocUnit);
        auto norm = m.value("normalize").toObject();
        assert(norm.value("orientation").toBool() == true);
        assert(norm.value("start").toBool() == true);
#ifdef CADGF_SORT_RINGS
        assert(norm.value("sortRings").toBool() == true);
#else
        assert(norm.value("sortRings").toBool() == false);
#endif
        std::cout << "Case 2 passed" << std::endl;
    }

    // Cleanup
    QDir(QDir::currentPath()).rmpath("qt_meta_test_tmp");
    std::cout << "Qt exporter meta tests passed" << std::endl;
    return 0;
}

