#include <QtCore/QCoreApplication>

#include <cassert>

#include "snap/snap_settings.hpp"

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);

    SnapSettings settings;
    int count = 0;
    QObject::connect(&settings, &SnapSettings::settingsChanged, &settings, [&count](){
        ++count;
    });

    settings.setSnapEndpoints(false);
    assert(count == 1);
    assert(!settings.snapEndpoints());

    settings.setSnapEndpoints(false);
    assert(count == 1);

    settings.setSnapMidpoints(false);
    assert(count == 2);
    assert(!settings.snapMidpoints());

    settings.setSnapGrid(true);
    assert(count == 3);
    assert(settings.snapGrid());

    return 0;
}
