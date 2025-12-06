#pragma once

#include <QDockWidget>
#include <QList>
#include <QVariant>
class QTreeWidget;
class QCheckBox;

class PropertyPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit PropertyPanel(QWidget* parent = nullptr);
    ~PropertyPanel() override;
    void updateFromSelection(const QList<int>& entityIds);
    void setVisibleCheckState(Qt::CheckState state, bool silent=true);

signals:
    void propertyEdited(int entityId, const QString& key, const QVariant& value);
    void propertyEditedBatch(const QList<int>& entityIds, const QString& key, const QVariant& value);

private:
    QTreeWidget* m_tree{nullptr};
    QList<int> m_currentSelection;
    QCheckBox* m_visibleCheck{nullptr};
    bool m_internalChange{false};
};
