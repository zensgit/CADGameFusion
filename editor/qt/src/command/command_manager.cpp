#include "command/command_manager.hpp"
#include <QUndoCommand>

namespace CADGame {

// Adapter to wrap our Command class for QUndoStack
class CommandManager::CommandAdapter : public QUndoCommand {
public:
    explicit CommandAdapter(CommandPtr command, QUndoCommand* parent = nullptr)
        : QUndoCommand(command->name(), parent)
        , m_command(std::move(command)) {
    }

    void undo() override {
        if (m_command) {
            m_command->undo();
        }
    }

    void redo() override {
        if (m_command) {
            m_command->redo();
        }
    }

    int id() const override {
        return m_command ? m_command->id() : -1;
    }

    bool mergeWith(const QUndoCommand* other) override {
        auto* otherAdapter = dynamic_cast<const CommandAdapter*>(other);
        if (!otherAdapter || !m_command) {
            return false;
        }
        return m_command->mergeWith(otherAdapter->m_command.get());
    }

private:
    CommandPtr m_command;
};

CommandManager::CommandManager(QObject* parent)
    : QObject(parent)
    , m_undoStack(new QUndoStack(this)) {

    // Connect signals
    connect(m_undoStack, &QUndoStack::canUndoChanged,
            this, &CommandManager::canUndoChanged);
    connect(m_undoStack, &QUndoStack::canRedoChanged,
            this, &CommandManager::canRedoChanged);
    connect(m_undoStack, &QUndoStack::undoTextChanged,
            this, &CommandManager::undoTextChanged);
    connect(m_undoStack, &QUndoStack::redoTextChanged,
            this, &CommandManager::redoTextChanged);
}

CommandManager::~CommandManager() = default;

bool CommandManager::executeCommand(CommandPtr command) {
    if (!command || !command->canExecute()) {
        return false;
    }

    QString commandName = command->name();

    // Execute the command first
    if (!command->execute()) {
        return false;
    }

    // If execution succeeded and command supports undo, add to stack
    if (command->canUndo()) {
        m_undoStack->push(new CommandAdapter(std::move(command)));
    }

    emit commandExecuted(commandName);
    return true;
}

void CommandManager::registerCommand(const QString& name, std::function<CommandPtr()> factory) {
    m_commandFactories[name] = factory;
}

bool CommandManager::executeByName(const QString& name) {
    auto it = m_commandFactories.find(name);
    if (it == m_commandFactories.end()) {
        return false;
    }

    CommandPtr command = it.value()();
    if (!command) {
        return false;
    }

    return executeCommand(std::move(command));
}

void CommandManager::registerShortcut(const QKeySequence& shortcut, const QString& commandName) {
    m_shortcuts[shortcut] = commandName;
}

void CommandManager::unregisterShortcut(const QKeySequence& shortcut) {
    m_shortcuts.remove(shortcut);
}

bool CommandManager::canUndo() const {
    return m_undoStack->canUndo();
}

bool CommandManager::canRedo() const {
    return m_undoStack->canRedo();
}

QString CommandManager::undoText() const {
    return m_undoStack->undoText();
}

QString CommandManager::redoText() const {
    return m_undoStack->redoText();
}

void CommandManager::undo() {
    m_undoStack->undo();
}

void CommandManager::redo() {
    m_undoStack->redo();
}

void CommandManager::clear() {
    m_undoStack->clear();
}

void CommandManager::setUndoLimit(int limit) {
    m_undoStack->setUndoLimit(limit);
}

} // namespace CADGame