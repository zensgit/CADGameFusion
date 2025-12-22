#include "core/document.hpp"
#include "core/geometry2d.hpp"

#include <cassert>

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

    bool ok = doc.set_entity_visible(id1, false);
    assert(ok);
    ok = doc.set_entity_color(id1, 0x112233u);
    assert(ok);
    int gid = doc.alloc_group_id();
    ok = doc.set_entity_group_id(id1, gid);
    assert(ok);

    const auto* e1_updated = doc.get_entity(id1);
    assert(e1_updated);
    assert(!e1_updated->visible);
    assert(e1_updated->color == 0x112233u);
    assert(e1_updated->groupId == gid);

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
    assert(e2_moved && e2_moved->payload);
    const auto* moved_pl = static_cast<const core::Polyline*>(e2_moved->payload.get());
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
    return 0;
}
