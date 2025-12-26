#include "core/document.hpp"

#include <cassert>

int main() {
    core::Document doc;

    const auto& meta = doc.metadata();
    assert(meta.label.empty());
    assert(meta.author.empty());
    assert(meta.company.empty());
    assert(meta.comment.empty());
    assert(meta.created_at.empty());
    assert(meta.modified_at.empty());
    assert(meta.unit_name.empty());
    assert(meta.meta.empty());

    assert(doc.set_label("Sample"));
    assert(doc.set_author("Author"));
    assert(doc.set_company("Company"));
    assert(doc.set_comment("Comment"));
    assert(doc.set_created_at("2025-12-25T00:00:00Z"));
    assert(doc.set_modified_at("2025-12-25T01:00:00Z"));
    assert(doc.set_unit_name("mm"));

    assert(doc.metadata().label == "Sample");
    assert(doc.metadata().author == "Author");
    assert(doc.metadata().company == "Company");
    assert(doc.metadata().comment == "Comment");
    assert(doc.metadata().created_at == "2025-12-25T00:00:00Z");
    assert(doc.metadata().modified_at == "2025-12-25T01:00:00Z");
    assert(doc.metadata().unit_name == "mm");

    assert(doc.set_meta_value("key1", "value1"));
    assert(doc.set_meta_value("key2", "value2"));
    assert(doc.metadata().meta.size() == 2);
    assert(doc.metadata().meta.at("key1") == "value1");
    assert(doc.metadata().meta.at("key2") == "value2");

    assert(doc.remove_meta_value("key1"));
    assert(doc.metadata().meta.size() == 1);
    assert(doc.metadata().meta.at("key2") == "value2");

    doc.clear();
    assert(doc.metadata().label.empty());
    assert(doc.metadata().meta.empty());

    return 0;
}
