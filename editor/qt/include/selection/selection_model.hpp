#pragma once

#include <QObject>
#include <QList>

class SelectionModel : public QObject {
    Q_OBJECT
public:
    explicit SelectionModel(QObject* parent = nullptr);

    const QList<qulonglong>& selection() const { return selection_; }
    bool isEmpty() const { return selection_.isEmpty(); }
    void setSelection(const QList<qulonglong>& ids);

signals:
    void selectionChanged(const QList<qulonglong>& ids);

private:
    QList<qulonglong> selection_;
};
