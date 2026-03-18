// json2dxf: reads a CADGameFusion document.json and writes DXF to stdout or file.
// Usage: json2dxf <document.json> [output.dxf]
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#include "third_party/json.hpp"
#include "dxf_writer.hpp"

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: json2dxf <document.json> [output.dxf]\n";
        return 1;
    }

    std::ifstream in(argv[1]);
    if (!in) {
        std::cerr << "Cannot open: " << argv[1] << "\n";
        return 1;
    }

    nlohmann::json doc;
    try {
        in >> doc;
    } catch (const std::exception& e) {
        std::cerr << "JSON parse error: " << e.what() << "\n";
        return 1;
    }

    std::string dxf = dxf_writer::writeDxf(doc);

    if (argc >= 3) {
        std::ofstream out(argv[2]);
        if (!out) {
            std::cerr << "Cannot write: " << argv[2] << "\n";
            return 1;
        }
        out << dxf;
        std::cerr << "Wrote " << dxf.size() << " bytes to " << argv[2] << "\n";
    } else {
        std::cout << dxf;
    }
    return 0;
}
