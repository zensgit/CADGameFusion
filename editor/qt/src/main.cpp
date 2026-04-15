#include <QApplication>
#include "mainwindow.hpp"

int main(int argc, char** argv) {
    QApplication app(argc, argv);
    QCoreApplication::setOrganizationName("CADGameFusion");
    QCoreApplication::setApplicationName("EditorQt");
    MainWindow w;
    w.resize(1200, 800);
    w.show();
    // If a file path is provided as argument, import it automatically
    if (argc > 1) {
        w.importFileFromPath(QString::fromUtf8(argv[1]));
    }
    return app.exec();
}
