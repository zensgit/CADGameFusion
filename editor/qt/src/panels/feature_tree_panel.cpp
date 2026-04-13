#include "panels/feature_tree_panel.hpp"
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QHeaderView>

FeatureTreePanel::FeatureTreePanel(QWidget* parent) : QDockWidget("Feature Tree", parent) {
    auto* w = new QWidget(this);
    auto* lay = new QVBoxLayout(w);
    lay->setContentsMargins(2, 2, 2, 2);

    m_tree = new QTreeWidget(w);
    m_tree->setColumnCount(2);
    m_tree->setHeaderLabels({"Feature", "Type"});
    m_tree->header()->setSectionResizeMode(0, QHeaderView::Stretch);
    m_tree->header()->setSectionResizeMode(1, QHeaderView::ResizeToContents);
    lay->addWidget(m_tree);
    setWidget(w);

    connect(m_tree, &QTreeWidget::itemClicked, this, [this](QTreeWidgetItem* item, int){
        int id = item->data(0, Qt::UserRole).toInt();
        emit featureSelected(id);
    });
    connect(m_tree, &QTreeWidget::itemDoubleClicked, this, [this](QTreeWidgetItem* item, int){
        int id = item->data(0, Qt::UserRole).toInt();
        emit featureDoubleClicked(id);
    });
}

void FeatureTreePanel::clear() {
    m_tree->clear();
}

void FeatureTreePanel::setFeatures(const QVector<FeatureEntry>& features) {
    m_tree->clear();
    QMap<int, QTreeWidgetItem*> itemMap;

    // First pass: create all items
    for (const auto& f : features) {
        auto* item = new QTreeWidgetItem();
        item->setText(0, f.name);
        item->setText(1, f.kind);
        item->setData(0, Qt::UserRole, f.id);
        itemMap[f.id] = item;
    }

    // Second pass: build hierarchy
    for (const auto& f : features) {
        auto* item = itemMap.value(f.id);
        if (!item) continue;
        if (f.parentId >= 0 && itemMap.contains(f.parentId)) {
            itemMap[f.parentId]->addChild(item);
        } else {
            m_tree->addTopLevelItem(item);
        }
    }
    m_tree->expandAll();
}
