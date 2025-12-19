#pragma once

#include <QDockWidget>
#include <QList>
#include <QVariant>
#include <QtGlobal>
class QTreeWidget;
class QCheckBox;

class PropertyPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit PropertyPanel(QWidget* parent = nullptr);
    ~PropertyPanel() override;
    void updateFromSelection(const QList<qulonglong>& entityIds);
    void setVisibleCheckState(Qt::CheckState state, bool silent=true);

signals:
    void propertyEdited(qulonglong entityId, const QString& key, const QVariant& value);
    void propertyEditedBatch(const QList<qulonglong>& entityIds, const QString& key, const QVariant& value);

private:
    QTreeWidget* m_tree{nullptr};
    QList<qulonglong> m_currentSelection;
    QCheckBox* m_visibleCheck{nullptr};
    bool m_internalChange{false};
};
