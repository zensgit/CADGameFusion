#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cassert>
#include <cmath>
#include <cstdlib>
#include <string>
#include <vector>

static void assert_near(double value, double expected, double eps = 1e-6) {
    assert(std::fabs(value - expected) <= eps);
}

static std::string read_entity_name(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    assert(cadgf_document_get_entity_name(doc, id, nullptr, 0, &required));
    assert(required > 0);
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    assert(cadgf_document_get_entity_name(doc, id, buf.data(),
                                          static_cast<int>(buf.size()), &required2));
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static double encoded_width_factor(const std::string& name) {
    const std::string::size_type sep = name.find('\x1f');
    if (sep == std::string::npos) return 1.0;
    return std::strtod(name.substr(sep + 1).c_str(), nullptr);
}

int main() {
    cadgf_document* doc = cadgf_document_create();
    assert(doc);

    CadgfDrwAdapter adapter(doc);

    DRW_Text fit;
    fit.text = "AB";
    fit.height = 10.0;
    fit.basePoint.x = 10.0;
    fit.basePoint.y = 20.0;
    fit.secPoint.x = 70.0;
    fit.secPoint.y = 20.0;
    fit.alignH = DRW_Text::HFit;
    fit.alignV = DRW_Text::VBaseLine;
    fit.layer = "0";

    adapter.addText(fit);

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count == 1);

    cadgf_entity_id id = 0;
    assert(cadgf_document_get_entity_id_at(doc, 0, &id));
    assert(id != 0);

    cadgf_vec2 pos{};
    double height = 0.0;
    double rotation = 0.0;
    int required = 0;
    assert(cadgf_document_get_text(doc, id, &pos, &height, &rotation,
                                   nullptr, 0, &required));

    // FIT text starts at the base point and stretches toward the second point.
    // The previous adapter path used secPoint as the draw origin, shifting title
    // block ATTRIB/FIT text to the right.
    assert_near(pos.x, 10.0);
    assert_near(pos.y, 20.0);
    assert_near(height, 10.0);

    // Default latin width estimate is 0.6 * height per char. "AB" is 12 world
    // units wide before FIT; the base->second distance is 60, so the encoded
    // width factor should become 5.
    assert_near(encoded_width_factor(read_entity_name(doc, id)), 5.0, 1e-3);

    cadgf_document_destroy(doc);
    return 0;
}
