#include "selection/selection_model.hpp"

SelectionModel::SelectionModel(QObject* parent)
    : QObject(parent) {}

void SelectionModel::setSelection(const QList<qulonglong>& ids) {
    if (selection_ == ids) return;
    selection_ = ids;
    emit selectionChanged(selection_);
}
