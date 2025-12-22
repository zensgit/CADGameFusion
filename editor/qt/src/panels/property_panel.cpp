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
    if (m_doc) m_doc->remove_observer(this);
    // Safely clean up to prevent crashes during shutdown
    // Since Qt manages widget hierarchy automatically, we don't need to
    // manually remove widgets from tree or delete them explicitly.
    // Just clear our pointers to avoid any potential issues.
    m_visibleCheck = nullptr;
    m_tree = nullptr;
}

void PropertyPanel::setDocument(core::Document* doc) {
    if (m_doc == doc) return;
    if (m_doc) m_doc->remove_observer(this);
    m_doc = doc;
    if (m_doc) m_doc->add_observer(this);
    refreshVisibleCheckState();
}

void PropertyPanel::setVisibleCheckState(Qt::CheckState state, bool silent) {
    if (!m_visibleCheck) return;
    if (silent) m_internalChange = true;
    m_visibleCheck->setCheckState(state);
    if (silent) m_internalChange = false;
}

Qt::CheckState PropertyPanel::computeVisibleCheckState() const {
    if (!m_doc || m_currentSelection.isEmpty()) return Qt::PartiallyChecked;
    bool anyTrue = false;
    bool anyFalse = false;
    bool hasAny = false;
    for (qulonglong id : m_currentSelection) {
        const auto* entity = m_doc->get_entity(static_cast<core::EntityId>(id));
        if (!entity) continue;
        hasAny = true;
        anyTrue = anyTrue || entity->visible;
        anyFalse = anyFalse || !entity->visible;
    }
    if (!hasAny) return Qt::PartiallyChecked;
    if (m_currentSelection.size() == 1) {
        return anyTrue ? Qt::Checked : Qt::Unchecked;
    }
    if (anyTrue && !anyFalse) return Qt::Checked;
    if (!anyTrue && anyFalse) return Qt::Unchecked;
    return Qt::PartiallyChecked;
}

void PropertyPanel::refreshVisibleCheckState() {
    if (!m_doc) return;
    if (!m_visibleCheck) return;
    Qt::CheckState state = computeVisibleCheckState();
    if (!m_visibleCheck->isTristate() && state == Qt::PartiallyChecked) {
        state = Qt::Unchecked;
    }
    setVisibleCheckState(state, true);
}

void PropertyPanel::on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) {
    if (&doc != m_doc) return;
    if (m_currentSelection.isEmpty()) return;
    if (event.type != core::DocumentChangeType::EntityMetaChanged) return;
    if (event.entityId == 0) {
        refreshVisibleCheckState();
        return;
    }
    for (qulonglong id : m_currentSelection) {
        if (static_cast<core::EntityId>(id) == event.entityId) {
            refreshVisibleCheckState();
            return;
        }
    }
}

void PropertyPanel::updateFromSelection(const QList<qulonglong>& entityIds) {
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
#if QT_VERSION >= QT_VERSION_CHECK(6, 9, 0)
        connect(m_visibleCheck, &QCheckBox::checkStateChanged, this, [this](Qt::CheckState state){
            if (m_internalChange) return;
            if (m_currentSelection.isEmpty()) return;
            bool v = (state == Qt::Checked);
            qDebug() << "PropertyPanel: Single selection visible changed to" << v << "for entity" << m_currentSelection[0];
            emit propertyEdited(m_currentSelection[0], "visible", v);
        });
#else
        connect(m_visibleCheck, &QCheckBox::stateChanged, this, [this](int stateInt){
            Qt::CheckState state = static_cast<Qt::CheckState>(stateInt);
            if (m_internalChange) return;
            if (m_currentSelection.isEmpty()) return;
            bool v = (state == Qt::Checked);
            qDebug() << "PropertyPanel: Single selection visible changed to" << v << "for entity" << m_currentSelection[0];
            emit propertyEdited(m_currentSelection[0], "visible", v);
        });
#endif
        m_internalChange = true;
        m_visibleCheck->setChecked(true);
        m_internalChange = false;
        refreshVisibleCheckState();
        m_tree->setItemWidget(visRow, 1, m_visibleCheck);
    } else if (entityIds.size() > 1) {
        for (qulonglong id : entityIds) root->addChild(new QTreeWidgetItem(QStringList{ "id", QString::number(id) }));
        // Visible tri-state
        auto* visRow = new QTreeWidgetItem(QStringList{ "visible", "" });
        m_tree->addTopLevelItem(visRow);

        // Always create a fresh checkbox for multi-selection
        m_visibleCheck = new QCheckBox(m_tree);
        m_visibleCheck->setTristate(true);
#if QT_VERSION >= QT_VERSION_CHECK(6, 9, 0)
        connect(m_visibleCheck, &QCheckBox::checkStateChanged, this, [this](Qt::CheckState state){
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
#else
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
#endif
        // Default to PartiallyChecked for multi-selection until Document state is available.
        m_internalChange = true;
        m_visibleCheck->setCheckState(Qt::PartiallyChecked);
        m_internalChange = false;
        refreshVisibleCheckState();
        m_tree->setItemWidget(visRow, 1, m_visibleCheck);
    }
    m_tree->expandAll();
}
