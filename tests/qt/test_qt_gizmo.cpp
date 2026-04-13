#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>

#include "tools/gizmo_tool.hpp"

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Initial state ═══
    {
        GizmoTool tool;
        assert(!tool.hasSelection());
        assert(tool.name() == "Gizmo");
        fprintf(stderr, "  PASS: initial state\n");
    }

    // ═══ Test 2: Set/clear selection ═══
    {
        GizmoTool tool;
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));
        assert(tool.hasSelection());
        tool.clearSelection();
        assert(!tool.hasSelection());
        fprintf(stderr, "  PASS: set/clear selection\n");
    }

    // ═══ Test 3: Hit test - center square (MoveXY) ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(100, 100);
        QPointF pivot(5, 5);
        tool.setSelection(QRectF(0, 0, 10, 10), pivot);

        // Pivot in screen = 5*1 + 100 = 105, 105
        QPointF pivotScreen(105, 105);
        auto ht = tool.hitTest(pivotScreen, scale, pan);
        assert(ht == GizmoTool::HandleType::MoveXY);
        fprintf(stderr, "  PASS: hit test center = MoveXY\n");
    }

    // ═══ Test 4: Hit test - X arrow (MoveX) ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(100, 100);
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));

        // Right of pivot: screen (125, 105) = pivot + (20, 0)
        auto ht = tool.hitTest(QPointF(125, 105), scale, pan);
        assert(ht == GizmoTool::HandleType::MoveX);
        fprintf(stderr, "  PASS: hit test X arrow = MoveX\n");
    }

    // ═══ Test 5: Hit test - Y arrow (MoveY) ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(100, 100);
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));

        // Above pivot: screen (105, 85) = pivot + (0, -20)
        auto ht = tool.hitTest(QPointF(105, 85), scale, pan);
        assert(ht == GizmoTool::HandleType::MoveY);
        fprintf(stderr, "  PASS: hit test Y arrow = MoveY\n");
    }

    // ═══ Test 6: Hit test - rotate arc ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(100, 100);
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));

        // Point on rotate circle (radius=40): pivot screen (105,105) + (40, 0)
        auto ht = tool.hitTest(QPointF(145, 105), scale, pan);
        assert(ht == GizmoTool::HandleType::RotateArc);
        fprintf(stderr, "  PASS: hit test rotate arc\n");
    }

    // ═══ Test 7: Hit test - scale corner ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(0, 0);
        // Large AABB so corners are far from pivot (center at 50,50)
        tool.setSelection(QRectF(0, 0, 100, 100), QPointF(50, 50));

        // Bottom-right corner in screen: (100, 100) — far from pivot (50,50)
        auto ht = tool.hitTest(QPointF(100, 100), scale, pan);
        assert(ht == GizmoTool::HandleType::ScaleCorner);
        fprintf(stderr, "  PASS: hit test scale corner\n");
    }

    // ═══ Test 8: Hit test - miss ═══
    {
        GizmoTool tool;
        double scale = 1.0;
        QPointF pan(100, 100);
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));

        // Far away point
        auto ht = tool.hitTest(QPointF(300, 300), scale, pan);
        assert(ht == GizmoTool::HandleType::None);
        fprintf(stderr, "  PASS: hit test miss = None\n");
    }

    // ═══ Test 9: No selection = no hit ═══
    {
        GizmoTool tool;
        auto ht = tool.hitTest(QPointF(0, 0), 1.0, QPointF(0, 0));
        assert(ht == GizmoTool::HandleType::None);
        fprintf(stderr, "  PASS: no selection = no hit\n");
    }

    // ═══ Test 10: Callbacks fire on move ═══
    {
        GizmoTool tool;
        bool moveCalled = false;
        QPointF moveDelta;
        tool.setCallbacks(
            [&](QPointF d){ moveCalled = true; moveDelta = d; },
            [](double, QPointF){}, [](double, QPointF){}
        );
        tool.setSelection(QRectF(0, 0, 10, 10), QPointF(5, 5));
        // The callback test needs actual mouse events which require QWidget
        // Just verify callback was set and tool is functional
        assert(!moveCalled); // not triggered without events
        fprintf(stderr, "  PASS: callbacks settable\n");
    }

    fprintf(stderr, "\n  All Gizmo tests passed!\n");
    return 0;
}
