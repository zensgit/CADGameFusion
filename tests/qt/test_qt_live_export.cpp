#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QDir>
#include <QtCore/QTemporaryDir>
#include <QtCore/QTimer>

#include <cassert>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "live_export_manager.hpp"

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Disabled by default ═══
    {
        core::Document doc;
        LiveExportManager mgr;
        mgr.setDocument(&doc);
        assert(!mgr.isEnabled());
        assert(mgr.exportDir().isEmpty());
        fprintf(stderr, "  PASS: disabled by default\n");
    }

    // ═══ Test 2: Enable/disable toggle ═══
    {
        core::Document doc;
        LiveExportManager mgr;
        mgr.setDocument(&doc);
        mgr.setEnabled(true);
        assert(mgr.isEnabled());
        mgr.setEnabled(false);
        assert(!mgr.isEnabled());
        fprintf(stderr, "  PASS: enable/disable toggle\n");
    }

    // ═══ Test 3: Export fires on document change ═══
    {
        QTemporaryDir tmpDir;
        assert(tmpDir.isValid());

        core::Document doc;
        LiveExportManager mgr;
        mgr.setDocument(&doc);
        mgr.setExportDir(tmpDir.path());
        mgr.setEnabled(true);

        int exportCount = 0;
        QString lastDir;
        QObject::connect(&mgr, &LiveExportManager::exported, [&exportCount, &lastDir](const QString& dir){
            ++exportCount;
            lastDir = dir;
        });

        // Add an entity to trigger document change
        core::Polyline pl;
        pl.points = {{0,0}, {1,0}, {1,1}, {0,0}};
        doc.add_polyline(pl, "test");

        // Process events + wait for debounce (300ms timer)
        // Use a short event loop with timeout
        QTimer::singleShot(500, &app, &QApplication::quit);
        app.exec();

        assert(exportCount == 1);
        assert(!lastDir.isEmpty());

        // Verify files were written
        QDir sceneDir(lastDir);
        assert(sceneDir.exists());
        fprintf(stderr, "  PASS: export fires on document change\n");
    }

    // ═══ Test 4: Debounce batches rapid changes ═══
    {
        QTemporaryDir tmpDir;
        assert(tmpDir.isValid());

        core::Document doc;
        LiveExportManager mgr;
        mgr.setDocument(&doc);
        mgr.setExportDir(tmpDir.path());
        mgr.setEnabled(true);

        int exportCount = 0;
        QObject::connect(&mgr, &LiveExportManager::exported, [&exportCount](const QString&){
            ++exportCount;
        });

        // Rapid changes - should debounce to 1 export
        core::Polyline pl;
        pl.points = {{0,0}, {1,0}, {1,1}, {0,0}};
        doc.add_polyline(pl, "a");
        doc.add_polyline(pl, "b");
        doc.add_polyline(pl, "c");

        QTimer::singleShot(500, &app, &QApplication::quit);
        app.exec();

        assert(exportCount == 1); // debounced to single export
        fprintf(stderr, "  PASS: debounce batches rapid changes\n");
    }

    // ═══ Test 5: Disabled manager does not export ═══
    {
        QTemporaryDir tmpDir;
        assert(tmpDir.isValid());

        core::Document doc;
        LiveExportManager mgr;
        mgr.setDocument(&doc);
        mgr.setExportDir(tmpDir.path());
        mgr.setEnabled(false);

        int exportCount = 0;
        QObject::connect(&mgr, &LiveExportManager::exported, [&exportCount](const QString&){
            ++exportCount;
        });

        core::Polyline pl;
        pl.points = {{0,0}, {1,0}, {1,1}, {0,0}};
        doc.add_polyline(pl, "test");

        QTimer::singleShot(500, &app, &QApplication::quit);
        app.exec();

        assert(exportCount == 0);
        fprintf(stderr, "  PASS: disabled does not export\n");
    }

    fprintf(stderr, "\n  All LiveExport tests passed!\n");
    return 0;
}
