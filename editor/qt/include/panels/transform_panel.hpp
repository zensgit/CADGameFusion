#pragma once

#include <QDockWidget>
#include <QPointF>

class QDoubleSpinBox;
class QPushButton;
class QLabel;

class TransformPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit TransformPanel(QWidget* parent = nullptr);

    void setCentroid(const QPointF& centroid);
    void setHasSelection(bool has);

signals:
    void moveRequested(double dx, double dy);
    void rotateRequested(double angleDeg);
    void scaleRequested(double factor);

private:
    QDoubleSpinBox* m_dx{nullptr};
    QDoubleSpinBox* m_dy{nullptr};
    QDoubleSpinBox* m_angle{nullptr};
    QDoubleSpinBox* m_factor{nullptr};
    QLabel* m_centroidLabel{nullptr};
    QPushButton* m_moveBtn{nullptr};
    QPushButton* m_rotateBtn{nullptr};
    QPushButton* m_scaleBtn{nullptr};
};
