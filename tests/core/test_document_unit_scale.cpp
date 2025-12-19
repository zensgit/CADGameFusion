#include "core/document.hpp"
#include <cassert>

int main() {
    core::Document doc;
    assert(doc.settings().unit_scale == 1.0);

    doc.settings().unit_scale = 2.5;
    assert(doc.settings().unit_scale == 2.5);

    doc.clear();
    assert(doc.settings().unit_scale == 1.0);
    return 0;
}
