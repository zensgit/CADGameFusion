#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include <cassert>

int main() {
    core::Document doc;
    int a = doc.alloc_group_id();
    int b = doc.alloc_group_id();
    assert(a >= 1);
    assert(b == a + 1);

    core::Polyline pl;
    pl.points = {{0,0},{1,0},{1,1},{0,0}};
    auto id = doc.add_polyline(pl, "test");
    doc.set_entity_group_id(id, 42);
    int c = doc.alloc_group_id();
    assert(c >= 43);
    return 0;
}
