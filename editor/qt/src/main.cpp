#include <QApplication>
#include "mainwindow.hpp"

int main(int argc, char** argv) {
    QApplication app(argc, argv);
    QCoreApplication::setOrganizationName("CADGameFusion");
    QCoreApplication::setApplicationName("EditorQt");
    MainWindow w;
    w.resize(900, 600);
    w.show();
    return app.exec();
}
