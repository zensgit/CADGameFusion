// Minimal example using the C API (core_c)
#include <stdio.h>
#include "core/core_c_api.h"

int main(void) {
  printf("core version: %s\n", core_get_version());
  core_document* doc = core_document_create();
  // A simple triangle (closed when consumed by ops)
  core_vec2 tri[3] = { {0,0}, {1,0}, {0,1} };
  core_entity_id id = core_document_add_polyline(doc, tri, 3);
  printf("added polyline id=%llu\n", (unsigned long long)id);

  // Triangulate polygon
  unsigned int idx[3]; int ic=0;
  if (core_triangulate_polygon(tri, 3, idx, &ic)) {
    printf("triangulated indices (%d): %u %u %u\n", ic, idx[0], idx[1], idx[2]);
  } else {
    printf("triangulation failed\n");
  }

  core_document_destroy(doc);
  return 0;
}

