#include "editor/qt/include/panels/layer_panel.hpp"
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QPushButton>
#include <QHeaderView>
#include <QCheckBox>
#include <QtGlobal>
#include <QMetaObject>

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

LayerPanel::~LayerPanel() {
    if (m_doc) m_doc->remove_observer(this);
}

void LayerPanel::setDocument(core::Document* doc) {
    if (m_doc == doc) {
        refresh();
        return;
    }
    if (m_doc) m_doc->remove_observer(this);
    m_doc = doc;
    if (m_doc) m_doc->add_observer(this);
    refresh();
}

void LayerPanel::scheduleRefresh() {
    if (refresh_pending_) return;
    refresh_pending_ = true;
    QMetaObject::invokeMethod(this, [this]() {
        refresh_pending_ = false;
        refresh();
    }, Qt::QueuedConnection);
}

void LayerPanel::on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) {
    if (&doc != m_doc) return;
    switch (event.type) {
        case core::DocumentChangeType::LayerChanged:
        case core::DocumentChangeType::Cleared:
        case core::DocumentChangeType::Reset:
            scheduleRefresh();
            break;
        default:
            break;
    }
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
