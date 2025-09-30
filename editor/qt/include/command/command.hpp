#pragma once

#include <QString>

// Minimal command interface independent of Qt's QUndoCommand.
// CommandManager adapts this to QUndoStack internally.
class Command {
public:
    virtual ~Command() = default;
    virtual void execute() = 0; // redo
    virtual void undo() = 0;
    virtual QString name() const = 0;
};

