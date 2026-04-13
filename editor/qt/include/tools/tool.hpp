#pragma once

#include <QString>

class QPainter;
class QMouseEvent;
class QKeyEvent;
class QPointF;

class Tool {
public:
    virtual ~Tool() = default;
    virtual bool mousePressEvent(QMouseEvent* e) { (void)e; return false; }
    virtual bool mouseMoveEvent(QMouseEvent* e) { (void)e; return false; }
    virtual bool mouseReleaseEvent(QMouseEvent* e) { (void)e; return false; }
    virtual bool keyPressEvent(QKeyEvent* e) { (void)e; return false; }
    virtual void paint(QPainter& painter, double scale, const QPointF& pan) {
        (void)painter; (void)scale; (void)pan;
    }
    virtual QString name() const = 0;
};
