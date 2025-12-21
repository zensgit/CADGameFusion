#include <QtCore/QCoreApplication>
#include <QtCore/QList>

#include <cassert>

#include "selection/selection_model.hpp"

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);

    SelectionModel model;
    int signalCount = 0;
    QList<qulonglong> last;

    QObject::connect(&model, &SelectionModel::selectionChanged, &model,
                     [&signalCount, &last](const QList<qulonglong>& ids){
        ++signalCount;
        last = ids;
    });

    QList<qulonglong> ids;
    ids << 1 << 2;
    model.setSelection(ids);
    assert(signalCount == 1);
    assert(last == ids);
    assert(model.selection() == ids);

    model.setSelection(ids);
    assert(signalCount == 1); // no change, no signal

    QList<qulonglong> ids2;
    ids2 << 2 << 3;
    model.setSelection(ids2);
    assert(signalCount == 2);
    assert(last == ids2);
    assert(model.selection() == ids2);

    return 0;
}
