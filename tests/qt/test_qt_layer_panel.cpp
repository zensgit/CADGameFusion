#include <QtWidgets/QApplication>
#include <QtWidgets/QTreeWidget>
#include <QtWidgets/QCheckBox>
#include <QtWidgets/QPushButton>
#include <QtCore/QByteArray>
#include <QtCore/QVariant>

#include <cassert>

#include "panels/layer_panel.hpp"
#include "core/document.hpp"

static QTreeWidget* findTree(LayerPanel& panel) {
    return panel.findChild<QTreeWidget*>();
}

static QTreeWidgetItem* findItemByLayerId(QTreeWidget* tree, int layerId) {
    if (!tree) return nullptr;
    for (int i = 0; i < tree->topLevelItemCount(); ++i) {
        auto* item = tree->topLevelItem(i);
        if (!item) continue;
        if (item->data(0, Qt::UserRole).toInt() == layerId) {
            return item;
        }
    }
    return nullptr;
}

static QCheckBox* checkboxForItem(QTreeWidget* tree, QTreeWidgetItem* item) {
    if (!tree || !item) return nullptr;
    return qobject_cast<QCheckBox*>(tree->itemWidget(item, 1));
}

static QPushButton* findAddLayerButton(LayerPanel& panel) {
    const auto buttons = panel.findChildren<QPushButton*>();
    for (auto* btn : buttons) {
        if (btn && btn->text() == "Add Layer") {
            return btn;
        }
    }
    return nullptr;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    int layer1 = doc.add_layer("Layer1", 0x123456u);
    assert(layer1 > 0);

    LayerPanel panel;
    panel.setDocument(&doc);
    QCoreApplication::processEvents();

    auto* tree = findTree(panel);
    assert(tree);
    assert(tree->topLevelItemCount() == 2);

    // Wire visibility changes to Document (mirrors MainWindow behavior).
    int lastLayerId = -1;
    bool lastVisible = true;
    QObject::connect(&panel, &LayerPanel::layerVisibilityChanged, &panel, [&doc, &lastLayerId, &lastVisible](int layerId, bool visible){
        lastLayerId = layerId;
        lastVisible = visible;
        doc.set_layer_visible(layerId, visible);
    });

    auto* item1 = findItemByLayerId(tree, layer1);
    assert(item1);
    auto* chk = checkboxForItem(tree, item1);
    assert(chk);

    chk->setChecked(false);
    QCoreApplication::processEvents();
    assert(lastLayerId == layer1);
    assert(lastVisible == false);
    auto* layerPtr = doc.get_layer(layer1);
    assert(layerPtr && !layerPtr->visible);

    chk->setChecked(true);
    QCoreApplication::processEvents();
    assert(lastLayerId == layer1);
    assert(lastVisible == true);
    layerPtr = doc.get_layer(layer1);
    assert(layerPtr && layerPtr->visible);

    // Wire add-layer to Document and refresh (mirrors MainWindow behavior).
    QObject::connect(&panel, &LayerPanel::layerAdded, &panel, [&doc, &panel](const QString& name){
        doc.add_layer(name.toStdString());
        panel.refresh();
    });

    auto* addBtn = findAddLayerButton(panel);
    assert(addBtn);
    addBtn->click();
    QCoreApplication::processEvents();
    assert(tree->topLevelItemCount() == 3);

    return 0;
}
