#include "command/command_manager.hpp"
#include <QUndoCommand>
#include <QDebug>

namespace {
class QtCmdAdapter : public QUndoCommand {
public:
    explicit QtCmdAdapter(std::unique_ptr<Command> c)
    : QUndoCommand(c ? c->name() : QString()), m_cmd(std::move(c)) {}
    void undo() override { if (m_cmd) m_cmd->undo(); }
    void redo() override { if (m_cmd) m_cmd->execute(); }
private:
    std::unique_ptr<Command> m_cmd;
};
}

CommandManager::CommandManager(QObject* parent) : QObject(parent) {}

void CommandManager::setUndoStack(QUndoStack* stack) {
    m_stack = stack;
    for (auto it = m_actions.begin(); it != m_actions.end(); ++it) {
        it.value()->setEnabled(m_stack != nullptr);
    }
}

void CommandManager::registerAction(const QString& id, QAction* action, const QKeySequence& shortcut) {
    if (!action) return;
    if (!shortcut.isEmpty()) action->setShortcut(shortcut);
    action->setEnabled(m_stack != nullptr);
    m_actions.insert(id, action);
}

void CommandManager::push(std::unique_ptr<Command> cmd) {
    if (!m_stack || !cmd) {
        qDebug() << "CommandManager::push - m_stack:" << m_stack << "cmd:" << cmd.get();
        return;
    }
    auto* qc = new QtCmdAdapter(std::move(cmd));
    qDebug() << "CommandManager::push - pushing command:" << qc->text();
    qDebug() << "Stack count before push:" << m_stack->count() << "isClean:" << m_stack->isClean();
    m_stack->push(qc);
    qDebug() << "Stack count after push:" << m_stack->count() << "isClean:" << m_stack->isClean();
    emit commandExecuted(qc->text());
}
