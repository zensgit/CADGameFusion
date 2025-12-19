#include "editor/qt/include/panels/layer_panel.hpp"
#include "core/document.hpp"
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QPushButton>
#include <QHeaderView>
#include <QCheckBox>
#include <QtGlobal>

LayerPanel::LayerPanel(QWidget* parent) : QDockWidget(parent) {
    setWindowTitle("Layers");
    auto* w = new QWidget(this);
    auto* lay = new QVBoxLayout(w);
    lay->setContentsMargins(2,2,2,2);

    auto* btnAdd = new QPushButton("Add Layer", w);
    connect(btnAdd, &QPushButton::clicked, this, &LayerPanel::onAddLayer);
    lay->addWidget(btnAdd);

    m_tree = new QTreeWidget(w);
    m_tree->setColumnCount(2);
    m_tree->setHeaderLabels({"Name", "Vis"});
    m_tree->header()->setSectionResizeMode(0, QHeaderView::Stretch);
    m_tree->header()->setSectionResizeMode(1, QHeaderView::ResizeToContents);
    lay->addWidget(m_tree);

    w->setLayout(lay);
    setWidget(w);
}

void LayerPanel::setDocument(core::Document* doc) {
    m_doc = doc;
    refresh();
}

void LayerPanel::refresh() {
    m_tree->clear();
    if (!m_doc) return;

    for (const auto& layer : m_doc->layers()) {
        auto* item = new QTreeWidgetItem(m_tree);
        item->setText(0, QString::fromStdString(layer.name));
        item->setData(0, Qt::UserRole, layer.id);
        
        auto* chk = new QCheckBox();
        chk->setChecked(layer.visible);
        // Use copy capture for layer id/state since layer is a reference in loop (wait, it's const ref from vector)
        // vector might realloc, so we should capture ID.
        int lid = layer.id;
#if QT_VERSION >= QT_VERSION_CHECK(6, 9, 0)
        connect(chk, &QCheckBox::checkStateChanged, this, [this, lid](Qt::CheckState state){
            emit layerVisibilityChanged(lid, state == Qt::Checked);
        });
#else
        connect(chk, &QCheckBox::stateChanged, this, [this, lid](int state){
            emit layerVisibilityChanged(lid, state == Qt::Checked);
        });
#endif
        m_tree->setItemWidget(item, 1, chk);
    }
}

void LayerPanel::onAddLayer() {
    emit layerAdded("New Layer");
}
