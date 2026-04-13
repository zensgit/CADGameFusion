#include "guide_manager.hpp"
#include <cmath>

void GuideManager::addGuide(Guide::Orientation orient, double pos) {
    m_guides.append(Guide{orient, pos});
    emit guidesChanged();
}

void GuideManager::removeGuide(int index) {
    if (index >= 0 && index < m_guides.size()) {
        m_guides.remove(index);
        emit guidesChanged();
    }
}

void GuideManager::clearGuides() {
    if (!m_guides.isEmpty()) {
        m_guides.clear();
        emit guidesChanged();
    }
}

bool GuideManager::findNearestGuide(double worldX, double worldY, double threshold,
                                     QPointF& snapPos, Guide::Orientation& orient) const {
    double bestDist = threshold;
    bool found = false;

    for (const auto& g : m_guides) {
        double dist;
        if (g.orientation == Guide::Horizontal) {
            dist = std::abs(worldY - g.position);
            if (dist < bestDist) {
                bestDist = dist;
                snapPos = QPointF(worldX, g.position);
                orient = Guide::Horizontal;
                found = true;
            }
        } else {
            dist = std::abs(worldX - g.position);
            if (dist < bestDist) {
                bestDist = dist;
                snapPos = QPointF(g.position, worldY);
                orient = Guide::Vertical;
                found = true;
            }
        }
    }
    return found;
}
