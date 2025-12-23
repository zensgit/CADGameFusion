#include "core/core_c_api.h"

int main() {
    cadgf_document* doc = cadgf_document_create();
    if (!doc) {
        return 1;
    }
    cadgf_document_destroy(doc);
    return 0;
}
