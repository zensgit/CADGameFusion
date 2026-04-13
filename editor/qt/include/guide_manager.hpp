#pragma once

#include <QObject>
#include <QVector>
#include <QPointF>

struct Guide {
    enum Orientation { Horizontal, Vertical };
    Orientation orientation;
    double position; // Y for Horizontal, X for Vertical
};

class GuideManager : public QObject {
    Q_OBJECT
public:
    explicit GuideManager(QObject* parent = nullptr) : QObject(parent) {}

    void addGuide(Guide::Orientation orient, double pos);
    void removeGuide(int index);
    void clearGuides();
    int guideCount() const { return m_guides.size(); }
    const QVector<Guide>& guides() const { return m_guides; }

    // Find nearest guide within threshold (world units). Returns true if found.
    bool findNearestGuide(double worldX, double worldY, double threshold,
                          QPointF& snapPos, Guide::Orientation& orient) const;

signals:
    void guidesChanged();

private:
    QVector<Guide> m_guides;
};
