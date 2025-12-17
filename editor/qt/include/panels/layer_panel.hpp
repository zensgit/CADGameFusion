#pragma once
#include <QDockWidget>

class QTreeWidget;
class QTreeWidgetItem;

namespace core { class Document; }

class LayerPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit LayerPanel(QWidget* parent = nullptr);
    void setDocument(core::Document* doc);
    void refresh();

signals:
    void layerVisibilityChanged(int layerId, bool visible);
    void layerColorChanged(int layerId, uint32_t color);
    void activeLayerChanged(int layerId);
    void layerAdded(const QString& name);

private:
    void onAddLayer();
    
    QTreeWidget* m_tree{nullptr};
    core::Document* m_doc{nullptr};
};
