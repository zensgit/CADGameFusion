#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace core {

struct ICommand {
    virtual ~ICommand() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
    virtual const char* name() const = 0;
};

class CommandStack {
public:
    void do_command(std::unique_ptr<ICommand> cmd);
    bool can_undo() const;
    bool can_redo() const;
    void undo();
    void redo();
    void clear();
private:
    std::vector<std::unique_ptr<ICommand>> done_;
    std::vector<std::unique_ptr<ICommand>> undone_;
};

} // namespace core

