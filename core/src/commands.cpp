#include "core/commands.hpp"

namespace core {

void CommandStack::do_command(std::unique_ptr<ICommand> cmd) {
    cmd->execute();
    done_.push_back(std::move(cmd));
    undone_.clear();
}

bool CommandStack::can_undo() const { return !done_.empty(); }
bool CommandStack::can_redo() const { return !undone_.empty(); }

void CommandStack::undo() {
    if (done_.empty()) return;
    auto cmd = std::move(done_.back());
    done_.pop_back();
    cmd->undo();
    undone_.push_back(std::move(cmd));
}

void CommandStack::redo() {
    if (undone_.empty()) return;
    auto cmd = std::move(undone_.back());
    undone_.pop_back();
    cmd->execute();
    done_.push_back(std::move(cmd));
}

void CommandStack::clear() {
    done_.clear();
    undone_.clear();
}

} // namespace core

