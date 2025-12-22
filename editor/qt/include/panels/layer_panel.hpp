#pragma once
#include <QDockWidget>

#include "core/document.hpp"

class QTreeWidget;
class QTreeWidgetItem;

class LayerPanel : public QDockWidget, public core::DocumentObserver {
    Q_OBJECT
public:
    explicit LayerPanel(QWidget* parent = nullptr);
    ~LayerPanel() override;
    void setDocument(core::Document* doc);
    void refresh();

signals:
    void layerVisibilityChanged(int layerId, bool visible);
    void layerColorChanged(int layerId, uint32_t color);
    void activeLayerChanged(int layerId);
    void layerAdded(const QString& name);

private:
    void onAddLayer();
    void scheduleRefresh();
    void on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) override;
    
    QTreeWidget* m_tree{nullptr};
    core::Document* m_doc{nullptr};
    bool refresh_pending_{false};
};
