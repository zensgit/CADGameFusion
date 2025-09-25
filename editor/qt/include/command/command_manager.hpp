#pragma once

#include "command.hpp"
#include <QObject>
#include <QUndoStack>
#include <QMap>
#include <QKeySequence>
#include <functional>

namespace CADGame {

/**
 * Command Manager - handles command execution, undo/redo, and shortcuts
 */
class CommandManager : public QObject {
    Q_OBJECT

public:
    explicit CommandManager(QObject* parent = nullptr);
    ~CommandManager();

    // Execute a command
    bool executeCommand(CommandPtr command);

    // Register a command factory
    void registerCommand(const QString& name, std::function<CommandPtr()> factory);

    // Execute a registered command by name
    bool executeByName(const QString& name);

    // Shortcut management
    void registerShortcut(const QKeySequence& shortcut, const QString& commandName);
    void unregisterShortcut(const QKeySequence& shortcut);

    // Undo/Redo operations
    bool canUndo() const;
    bool canRedo() const;
    QString undoText() const;
    QString redoText() const;

    // Get the undo stack for UI integration
    QUndoStack* undoStack() { return m_undoStack; }
    const QUndoStack* undoStack() const { return m_undoStack; }

    // Clear history
    void clear();

    // Set maximum undo levels
    void setUndoLimit(int limit);

public slots:
    void undo();
    void redo();

signals:
    void canUndoChanged(bool canUndo);
    void canRedoChanged(bool canRedo);
    void commandExecuted(const QString& commandName);
    void undoTextChanged(const QString& text);
    void redoTextChanged(const QString& text);

private:
    class CommandAdapter;

    QUndoStack* m_undoStack;
    QMap<QString, std::function<CommandPtr()>> m_commandFactories;
    QMap<QKeySequence, QString> m_shortcuts;
};

} // namespace CADGame