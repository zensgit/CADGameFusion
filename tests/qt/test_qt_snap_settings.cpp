#include <QtCore/QCoreApplication>

#include <cassert>
#include <cmath>

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

    settings.setSnapRadiusPixels(18.0);
    assert(count == 4);
    assert(std::abs(settings.snapRadiusPixels() - 18.0) < 1e-6);

    settings.setGridPixelSpacing(40.0);
    assert(count == 5);
    assert(std::abs(settings.gridPixelSpacing() - 40.0) < 1e-6);

    return 0;
}
