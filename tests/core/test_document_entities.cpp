#include "core/document.hpp"
#include "core/geometry2d.hpp"

#include <cassert>
#include <vector>

int main() {
    core::Document doc;
    core::Polyline pl;
    pl.points = {{0, 0}, {1, 0}, {1, 1}, {0, 0}};

    auto id1 = doc.add_polyline(pl, "first");
    auto id2 = doc.add_polyline(pl, "second");
    assert(id1 > 0);
    assert(id2 == id1 + 1);
    assert(doc.entities().size() == 2);

    const auto* e1 = doc.get_entity(id1);
    assert(e1);
    assert(e1->name == "first");
    assert(e1->layerId == 0);
    assert(e1->visible);
    assert(e1->groupId == -1);
    assert(e1->color == 0);
    assert(e1->line_type.empty());
    assert(e1->line_weight == 0.0);
    assert(e1->line_type_scale == 0.0);

    bool ok = doc.set_entity_visible(id1, false);
    assert(ok);
    ok = doc.set_entity_color(id1, 0x112233u);
    assert(ok);
    int gid = doc.alloc_group_id();
    ok = doc.set_entity_group_id(id1, gid);
    assert(ok);
    ok = doc.set_entity_line_type(id1, "DASHED");
    assert(ok);
    ok = doc.set_entity_line_weight(id1, 0.5);
    assert(ok);
    ok = doc.set_entity_line_type_scale(id1, 1.25);
    assert(ok);

    const auto* e1_updated = doc.get_entity(id1);
    assert(e1_updated);
    assert(!e1_updated->visible);
    assert(e1_updated->color == 0x112233u);
    assert(e1_updated->groupId == gid);
    assert(e1_updated->line_type == "DASHED");
    assert(e1_updated->line_weight == 0.5);
    assert(e1_updated->line_type_scale == 1.25);

    ok = doc.remove_entity(id1);
    assert(ok);
    assert(doc.get_entity(id1) == nullptr);
    assert(!doc.set_entity_visible(id1, true));
    assert(!doc.set_entity_group_id(id1, gid + 1));

    const auto* e2 = doc.get_entity(id2);
    assert(e2);
    assert(e2->name == "second");
    assert(e2->visible);
    assert(e2->groupId == -1);
    assert(e2->color == 0);

    core::Polyline moved;
    moved.points = {{2, 2}, {3, 2}, {3, 3}, {2, 2}};
    ok = doc.set_polyline_points(id2, moved);
    assert(ok);
    const auto* e2_moved = doc.get_entity(id2);
    assert(e2_moved);
    const auto* moved_pl = std::get_if<core::Polyline>(&e2_moved->payload);
    assert(moved_pl);
    assert(moved_pl->points.size() == moved.points.size());
    assert(moved_pl->points[0].x == 2.0 && moved_pl->points[0].y == 2.0);
    assert(moved_pl->points[1].x == 3.0 && moved_pl->points[1].y == 2.0);
    assert(moved_pl->points[2].x == 3.0 && moved_pl->points[2].y == 3.0);
    assert(moved_pl->points[3].x == 2.0 && moved_pl->points[3].y == 2.0);

    auto id3 = doc.add_polyline(pl, "third");
    assert(id3 == id2 + 1);
    assert(doc.entities().size() == 2);
    const auto* e2_again = doc.get_entity(id2);
    assert(e2_again);
    assert(e2_again->name == "second");

    doc.clear();
    assert(doc.entities().empty());
    assert(doc.layers().size() == 1);
    assert(doc.layers()[0].id == 0);
    assert(doc.layers()[0].name == "0");

    auto id4 = doc.add_polyline(pl, "after_clear");
    assert(id4 == 1);
    assert(doc.entities().size() == 1);

    core::Document doc2;
    auto pid = doc2.add_point(core::Vec2{1.0, 2.0}, "pt");
    assert(pid == 1);
    const auto* pt = doc2.get_point(pid);
    assert(pt && pt->p.x == 1.0 && pt->p.y == 2.0);
    ok = doc2.set_point(pid, core::Vec2{3.0, 4.0});
    assert(ok);
    const auto* pt2 = doc2.get_point(pid);
    assert(pt2 && pt2->p.x == 3.0 && pt2->p.y == 4.0);

    core::Line ln{core::Vec2{0.0, 0.0}, core::Vec2{1.0, 1.0}};
    auto lid = doc2.add_line(ln, "line");
    assert(doc2.get_line(lid));

    core::Arc arc{};
    arc.center = core::Vec2{0.0, 0.0};
    arc.radius = 2.0;
    arc.start_angle = 0.0;
    arc.end_angle = 1.57;
    auto aid = doc2.add_arc(arc, "arc");
    assert(doc2.get_arc(aid));

    core::Circle circle{};
    circle.center = core::Vec2{1.0, 2.0};
    circle.radius = 5.0;
    auto cid = doc2.add_circle(circle, "circle");
    assert(doc2.get_circle(cid));

    core::Ellipse ellipse{};
    ellipse.center = core::Vec2{2.0, 3.0};
    ellipse.rx = 4.0;
    ellipse.ry = 2.0;
    ellipse.rotation = 0.25;
    ellipse.start_angle = 0.0;
    ellipse.end_angle = 3.14;
    auto eid = doc2.add_ellipse(ellipse, "ellipse");
    const auto* e_out = doc2.get_ellipse(eid);
    assert(e_out && e_out->rx == 4.0);
    core::Ellipse ellipse2 = ellipse;
    ellipse2.rx = 5.0;
    ok = doc2.set_ellipse(eid, ellipse2);
    assert(ok);

    core::Spline spline{};
    spline.degree = 3;
    spline.control_points = {core::Vec2{0.0, 0.0}, core::Vec2{1.0, 1.0}, core::Vec2{2.0, 0.0}};
    spline.knots = {0.0, 0.0, 0.0, 1.0, 1.0, 1.0};
    auto sid = doc2.add_spline(spline, "spline");
    const auto* s_out = doc2.get_spline(sid);
    assert(s_out && s_out->control_points.size() == 3);
    core::Spline spline2 = spline;
    spline2.control_points[1] = core::Vec2{1.5, 1.0};
    ok = doc2.set_spline(sid, spline2);
    assert(ok);

    core::Text text{};
    text.pos = core::Vec2{1.0, 1.0};
    text.height = 2.0;
    text.rotation = 0.5;
    text.text = "Hello";
    auto tid = doc2.add_text(text, "text");
    const auto* t_out = doc2.get_text(tid);
    assert(t_out && t_out->text == "Hello");
    core::Text text2 = text;
    text2.text = "World";
    ok = doc2.set_text(tid, text2);
    assert(ok);
    return 0;
}
