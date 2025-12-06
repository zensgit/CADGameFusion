#pragma once

#include <functional>
#include <QString>
#include "command.hpp"

class LambdaCommand : public Command {
public:
    LambdaCommand(QString name, std::function<void()> doFn, std::function<void()> undoFn)
    : m_name(std::move(name)), m_do(std::move(doFn)), m_undo(std::move(undoFn)) {}
    void execute() override { if (m_do) m_do(); }
    void undo() override { if (m_undo) m_undo(); }
    QString name() const override { return m_name; }
private:
    QString m_name;
    std::function<void()> m_do;
    std::function<void()> m_undo;
};

