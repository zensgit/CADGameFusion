#pragma once

#include <QString>
#include <memory>

namespace CADGame {

/**
 * Base class for all commands in the Qt UI Shell
 * Implements Command pattern with undo/redo support
 */
class Command {
public:
    Command() = default;
    virtual ~Command() = default;

    // Execute the command
    virtual bool execute() = 0;

    // Undo the command
    virtual bool undo() = 0;

    // Redo the command (default implementation just calls execute)
    virtual bool redo() { return execute(); }

    // Get command name for display
    virtual QString name() const = 0;

    // Get command description
    virtual QString description() const { return name(); }

    // Check if command can be executed
    virtual bool canExecute() const { return true; }

    // Check if command can be undone
    virtual bool canUndo() const { return true; }

    // Merge with another command (for compression)
    virtual bool mergeWith(const Command* other) { return false; }

    // Get command ID for merging
    virtual int id() const { return -1; }

protected:
    bool m_executed = false;
};

using CommandPtr = std::unique_ptr<Command>;

} // namespace CADGame