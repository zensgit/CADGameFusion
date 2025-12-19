/*
 * C Header Compilation Test
 *
 * This file verifies that core_c_api.h and plugin_abi_c_v1.h
 * can be compiled with a pure C compiler (no C++ features).
 *
 * If this file fails to compile, it means C++ dependencies
 * were accidentally introduced into the stable C ABI headers.
 */

#include "core/core_c_api.h"
#include "core/plugin_abi_c_v1.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Test: Verify version macros are defined (if available) */
static void test_version_macros(void) {
#ifdef CADGF_CORE_API_VERSION
    printf("Core API Version: %d.%d.%d (0x%06X)\n",
           CADGF_CORE_API_VERSION_MAJOR,
           CADGF_CORE_API_VERSION_MINOR,
           CADGF_CORE_API_VERSION_PATCH,
           CADGF_CORE_API_VERSION);
#else
    printf("Core API Version: (macros not defined)\n");
#endif

#ifdef CADGF_PLUGIN_ABI_VERSION
    printf("Plugin ABI Version: %d.%d (0x%04X)\n",
           CADGF_PLUGIN_ABI_VERSION_MAJOR,
           CADGF_PLUGIN_ABI_VERSION_MINOR,
           CADGF_PLUGIN_ABI_VERSION);
#else
    printf("Plugin ABI v1: %d\n", CADGF_PLUGIN_ABI_V1);
#endif
}

/* Test: Verify feature flag macros */
static void test_feature_flags(void) {
    printf("Feature flags defined:\n");
    printf("  CADGF_FEATURE_EARCUT   = 0x%X\n", CADGF_FEATURE_EARCUT);
    printf("  CADGF_FEATURE_CLIPPER2 = 0x%X\n", CADGF_FEATURE_CLIPPER2);
#ifdef CADGF_FEATURE_TINYGLTF
    printf("  CADGF_FEATURE_TINYGLTF = 0x%X\n", CADGF_FEATURE_TINYGLTF);
#endif
}

/* Test: Verify struct sizes and layout */
static void test_struct_sizes(void) {
    printf("Struct sizes:\n");
    printf("  sizeof(cadgf_vec2)           = %zu\n", sizeof(cadgf_vec2));
    printf("  sizeof(cadgf_layer_info)     = %zu\n", sizeof(cadgf_layer_info));
    printf("  sizeof(cadgf_entity_info)    = %zu\n", sizeof(cadgf_entity_info));
    printf("  sizeof(cadgf_string_view)    = %zu\n", sizeof(cadgf_string_view));
    printf("  sizeof(cadgf_export_options_v1) = %zu\n", sizeof(cadgf_export_options_v1));
    printf("  sizeof(cadgf_error_v1)       = %zu\n", sizeof(cadgf_error_v1));
    printf("  sizeof(cadgf_plugin_desc_v1) = %zu\n", sizeof(cadgf_plugin_desc_v1));
    printf("  sizeof(cadgf_plugin_api_v1)  = %zu\n", sizeof(cadgf_plugin_api_v1));
    printf("  sizeof(cadgf_plugin_api_v1_min) = %zu\n", sizeof(cadgf_plugin_api_v1_min));
}

/* Test: Verify ABI compatibility check macro */
static void test_abi_check(void) {
#ifdef CADGF_PLUGIN_CHECK_ABI
    int compatible = CADGF_PLUGIN_CHECK_ABI(1, 0);
    printf("ABI v1.0 compatible: %s\n", compatible ? "YES" : "NO");

    int future_minor = CADGF_PLUGIN_CHECK_ABI(1, 99);
    printf("ABI v1.99 compatible: %s (expected NO)\n", future_minor ? "YES" : "NO");

    int major_mismatch = CADGF_PLUGIN_CHECK_ABI(2, 0);
    printf("ABI v2.0 compatible: %s (expected NO)\n", major_mismatch ? "YES" : "NO");
#else
    printf("ABI check macro not defined (requires PR1)\n");
#endif
}

/* Test: Verify return code macros */
static void test_return_codes(void) {
    printf("Return codes:\n");
    printf("  CADGF_SUCCESS = %d\n", CADGF_SUCCESS);
    printf("  CADGF_FAILURE = %d\n", CADGF_FAILURE);
}

/* Test: Verify entity type macros */
static void test_entity_types(void) {
    printf("Entity types:\n");
    printf("  CADGF_ENTITY_TYPE_POLYLINE = %d\n", CADGF_ENTITY_TYPE_POLYLINE);
}

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    printf("=== C Header Compilation Test ===\n\n");

    test_version_macros();
    printf("\n");

    test_feature_flags();
    printf("\n");

    test_struct_sizes();
    printf("\n");

    test_abi_check();
    printf("\n");

    test_return_codes();
    printf("\n");

    test_entity_types();
    printf("\n");

    printf("=== All compile-time checks passed ===\n");
    printf("Headers are valid C (no C++ dependencies)\n");

    return 0;
}
