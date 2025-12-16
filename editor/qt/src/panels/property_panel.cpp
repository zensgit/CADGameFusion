#include "editor/qt/include/panels/property_panel.hpp"
#include <QTreeWidget>
#include <QVBoxLayout>
#include <QCheckBox>
#include <QHBoxLayout>

PropertyPanel::PropertyPanel(QWidget* parent) : QDockWidget(parent) {
    setWindowTitle("Properties");
    auto* w = new QWidget(this);
    auto* lay = new QVBoxLayout(w);
    lay->setContentsMargins(4,4,4,4);
    m_tree = new QTreeWidget(w);
    m_tree->setColumnCount(2);
    QStringList headers; headers << "Property" << "Value"; m_tree->setHeaderLabels(headers);
    lay->addWidget(m_tree);
    w->setLayout(lay);
    setWidget(w);
}

PropertyPanel::~PropertyPanel() {
    // Safely clean up to prevent crashes during shutdown
    // Since Qt manages widget hierarchy automatically, we don't need to
    // manually remove widgets from tree or delete them explicitly.
    // Just clear our pointers to avoid any potential issues.
    m_visibleCheck = nullptr;
    m_tree = nullptr;
}

void PropertyPanel::setVisibleCheckState(Qt::CheckState state, bool silent) {
    if (!m_visibleCheck) return;
    if (silent) m_internalChange = true;
    m_visibleCheck->setCheckState(state);
    if (silent) m_internalChange = false;
}

void PropertyPanel::updateFromSelection(const QList<int>& entityIds) {
    qDebug() << "PropertyPanel::updateFromSelection - entityIds:" << entityIds;
    m_currentSelection = entityIds;

    // Clean up checkbox before clearing tree to prevent dangling connections
    if (m_visibleCheck) {
        m_visibleCheck->disconnect();  // Disconnect all signals
        delete m_visibleCheck;
        m_visibleCheck = nullptr;
    }

    m_tree->clear();
    if (entityIds.isEmpty()) {
        auto* item = new QTreeWidgetItem(QStringList{ "Selection", "<none>" });
        m_tree->addTopLevelItem(item);
        return;
    }
    // Minimal metadata preview (IDs only in v0.1)
    auto* root = new QTreeWidgetItem(QStringList{ "Selection", QString::number(entityIds.size()) });
    m_tree->addTopLevelItem(root);

    if (entityIds.size() == 1) {
        root->addChild(new QTreeWidgetItem(QStringList{ "id", QString::number(entityIds[0]) }));
        // Visible checkbox row
        auto* visRow = new QTreeWidgetItem(QStringList{ "visible", "" });
        m_tree->addTopLevelItem(visRow);

        // Always create a fresh checkbox for single selection
        m_visibleCheck = new QCheckBox(m_tree);
        m_visibleCheck->setTristate(false);
        connect(m_visibleCheck, &QCheckBox::stateChanged, this, [this](int stateInt){
            Qt::CheckState state = static_cast<Qt::CheckState>(stateInt);
            if (m_internalChange) return;
            if (m_currentSelection.isEmpty()) return;
            bool v = (state == Qt::Checked);
            qDebug() << "PropertyPanel: Single selection visible changed to" << v << "for entity" << m_currentSelection[0];
            emit propertyEdited(m_currentSelection[0], "visible", v);
        });
        m_internalChange = true;
        m_visibleCheck->setChecked(true);
        m_internalChange = false;
        m_tree->setItemWidget(visRow, 1, m_visibleCheck);
    } else if (entityIds.size() > 1) {
        for (int id : entityIds) root->addChild(new QTreeWidgetItem(QStringList{ "id", QString::number(id) }));
        // Visible tri-state
        auto* visRow = new QTreeWidgetItem(QStringList{ "visible", "" });
        m_tree->addTopLevelItem(visRow);

        // Always create a fresh checkbox for multi-selection
        m_visibleCheck = new QCheckBox(m_tree);
        m_visibleCheck->setTristate(true);
        connect(m_visibleCheck, &QCheckBox::stateChanged, this, [this](int stateInt){
            Qt::CheckState state = static_cast<Qt::CheckState>(stateInt);
            if (m_internalChange) return;
            if (m_currentSelection.isEmpty()) return;
            if (state == Qt::PartiallyChecked) {
                qDebug() << "PropertyPanel: Ignoring PartiallyChecked state click";
                return;
            }
            bool v = (state == Qt::Checked);
            qDebug() << "PropertyPanel: Batch visible changed to" << v << "for entities" << m_currentSelection;
            emit propertyEditedBatch(m_currentSelection, "visible", v);
        });
        // Compute tri-state from current selection visibility
        bool anyChecked = false, anyUnchecked = false;
        // We cannot access CanvasWidget here; rely on a temporary hint via tooltip if needed.
        // The main window will emit an update with actual states when selection changes.
        // Default to PartiallyChecked, but try to infer from existing item widgets if any.
        // For now, leave as PartiallyChecked to avoid lying; MainWindow can refresh with exact state.
        Qt::CheckState cs = Qt::PartiallyChecked;
        m_internalChange = true;
        m_visibleCheck->setCheckState(cs);
        m_internalChange = false;
        m_tree->setItemWidget(visRow, 1, m_visibleCheck);
    }
    m_tree->expandAll();
}
