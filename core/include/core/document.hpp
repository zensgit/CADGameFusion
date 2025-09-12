#pragma once

#include <memory>
#include <string>
#include <vector>
#include <cstdint>

namespace core {

struct Vec2;
struct Polyline;

using EntityId = uint64_t;

enum class EntityType { Polyline };

struct Entity {
    EntityId id{};
    EntityType type{EntityType::Polyline};
    std::string name;
    std::shared_ptr<void> payload; // simple placeholder, to be replaced by variant
};

struct DocumentSettings {
    double unit_scale{1.0};
};

class Document {
public:
    Document();
    ~Document();

    EntityId add_polyline(const Polyline& pl, const std::string& name = "");
    bool     remove_entity(EntityId id);

    const std::vector<Entity>& entities() const { return entities_; }
    DocumentSettings& settings() { return settings_; }
    const DocumentSettings& settings() const { return settings_; }

private:
    DocumentSettings settings_{};
    std::vector<Entity> entities_{};
    EntityId next_id_{1};
};

} // namespace core

