#pragma once

#include <QDockWidget>
#include <QList>
#include <QVariant>
#include <QtGlobal>

#include "core/document.hpp"
class QTreeWidget;
class QCheckBox;

class PropertyPanel : public QDockWidget, public core::DocumentObserver {
    Q_OBJECT
public:
    explicit PropertyPanel(QWidget* parent = nullptr);
    ~PropertyPanel() override;
    void setDocument(core::Document* doc);
    void updateFromSelection(const QList<qulonglong>& entityIds);
    void setVisibleCheckState(Qt::CheckState state, bool silent=true);

signals:
    void propertyEdited(qulonglong entityId, const QString& key, const QVariant& value);
    void propertyEditedBatch(const QList<qulonglong>& entityIds, const QString& key, const QVariant& value);

private:
    Qt::CheckState computeVisibleCheckState() const;
    void refreshVisibleCheckState();
    void on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) override;

    QTreeWidget* m_tree{nullptr};
    QList<qulonglong> m_currentSelection;
    QCheckBox* m_visibleCheck{nullptr};
    core::Document* m_doc{nullptr};
    bool m_internalChange{false};
};
