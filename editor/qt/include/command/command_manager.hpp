#pragma once

#include <QObject>
#include <QHash>
#include <QUndoStack>
#include <QAction>
#include <memory>
#include "command.hpp"

class CommandManager : public QObject {
    Q_OBJECT
public:
    explicit CommandManager(QObject* parent = nullptr);
    void setUndoStack(QUndoStack* stack);
    QUndoStack* stack() const { return m_stack; }

    // Registers a QAction with a shortcut and keeps it in sync with undo stack state
    void registerAction(const QString& id, QAction* action, const QKeySequence& shortcut = {});

    // Push a command: wraps into QUndoCommand via adapter
    void push(std::unique_ptr<Command> cmd);

signals:
    void commandExecuted(const QString& name);

private:
    QUndoStack* m_stack{nullptr};
    QHash<QString, QAction*> m_actions;
};

