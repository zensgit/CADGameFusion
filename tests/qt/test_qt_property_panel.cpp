#include <QtWidgets/QApplication>
#include <QtWidgets/QCheckBox>
#include <QtCore/QByteArray>
#include <QtCore/QList>
#include <QtCore/QVariant>

#include <cassert>

#include "panels/property_panel.hpp"

static QCheckBox* findVisibleCheck(PropertyPanel& panel) {
    return panel.findChild<QCheckBox*>();
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    PropertyPanel panel;

    int singleEdits = 0;
    qulonglong singleId = 0;
    QString singleKey;
    QVariant singleValue;
    QObject::connect(&panel, &PropertyPanel::propertyEdited, &panel,
                     [&singleEdits, &singleId, &singleKey, &singleValue](qulonglong id, const QString& key, const QVariant& value) {
        singleEdits++;
        singleId = id;
        singleKey = key;
        singleValue = value;
    });

    int batchEdits = 0;
    QList<qulonglong> batchIds;
    QString batchKey;
    QVariant batchValue;
    QObject::connect(&panel, &PropertyPanel::propertyEditedBatch, &panel,
                     [&batchEdits, &batchIds, &batchKey, &batchValue](const QList<qulonglong>& ids, const QString& key, const QVariant& value) {
        batchEdits++;
        batchIds = ids;
        batchKey = key;
        batchValue = value;
    });

    QList<qulonglong> singleSelection;
    singleSelection << 42;
    panel.updateFromSelection(singleSelection);
    QCoreApplication::processEvents();

    auto* singleCheck = findVisibleCheck(panel);
    assert(singleCheck);

    panel.setVisibleCheckState(Qt::Unchecked, true);
    QCoreApplication::processEvents();
    assert(singleEdits == 0);

    singleCheck->setChecked(false);
    QCoreApplication::processEvents();
    assert(singleEdits == 1);
    assert(singleId == 42);
    assert(singleKey == "visible");
    assert(!singleValue.toBool());

    singleCheck->setChecked(true);
    QCoreApplication::processEvents();
    assert(singleEdits == 2);
    assert(singleValue.toBool());

    QList<qulonglong> batchSelection;
    batchSelection << 7 << 11;
    panel.updateFromSelection(batchSelection);
    QCoreApplication::processEvents();

    auto* batchCheck = findVisibleCheck(panel);
    assert(batchCheck);

    batchCheck->setCheckState(Qt::Checked);
    QCoreApplication::processEvents();
    assert(batchEdits == 1);
    assert(batchIds == batchSelection);
    assert(batchKey == "visible");
    assert(batchValue.toBool());

    return 0;
}
