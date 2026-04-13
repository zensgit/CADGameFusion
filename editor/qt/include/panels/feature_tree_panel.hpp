#pragma once

#include <QDockWidget>
#include <QVector>
#include <QString>

class QTreeWidget;
class QTreeWidgetItem;

struct FeatureEntry {
    int id{0};
    QString name;
    QString kind; // "Sketch", "Extrude", "Revolve"
    int parentId{-1}; // -1 = root
};

class FeatureTreePanel : public QDockWidget {
    Q_OBJECT
public:
    explicit FeatureTreePanel(QWidget* parent = nullptr);

    void setFeatures(const QVector<FeatureEntry>& features);
    void clear();

signals:
    void featureSelected(int featureId);
    void featureDoubleClicked(int featureId);

private:
    QTreeWidget* m_tree{nullptr};
};
