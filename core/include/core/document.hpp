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
    int layerId{0}; // 0 is default layer
    std::shared_ptr<void> payload; // simple placeholder, to be replaced by variant
};

struct Layer {
    int id{0};
    std::string name;
    uint32_t color{0xFFFFFF}; // 0xRRGGBB
    bool visible{true};
    bool locked{false};
};

struct DocumentSettings {
    double unit_scale{1.0};
};

class Document {
public:
    Document();
    ~Document();

    // Layer management
    int add_layer(const std::string& name, uint32_t color = 0xFFFFFF);
    Layer* get_layer(int id);
    const Layer* get_layer(int id) const;
    const std::vector<Layer>& layers() const { return layers_; }

    EntityId add_polyline(const Polyline& pl, const std::string& name = "", int layerId = 0);
    bool     remove_entity(EntityId id);

    const std::vector<Entity>& entities() const { return entities_; }
    DocumentSettings& settings() { return settings_; }
    const DocumentSettings& settings() const { return settings_; }

private:
    DocumentSettings settings_{};
    std::vector<Entity> entities_{};
    std::vector<Layer> layers_{};
    EntityId next_id_{1};
    int next_layer_id_{1};
};

} // namespace core
