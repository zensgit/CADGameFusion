#include "panels/align_panel.hpp"

#include <QGridLayout>
#include <QGroupBox>
#include <QPushButton>
#include <QVBoxLayout>

AlignPanel::AlignPanel(QWidget* parent) : QDockWidget("Align", parent) {
    auto* content = new QWidget(this);
    auto* layout = new QVBoxLayout(content);
    layout->setContentsMargins(6, 6, 6, 6);

    // Align section
    auto* alignBox = new QGroupBox("Align");
    auto* grid = new QGridLayout(alignBox);

    static const char* labels[] = {"Left", "Center H", "Right", "Top", "Center V", "Bottom"};
    for (int i = 0; i < 6; ++i) {
        m_btns[i] = new QPushButton(labels[i]);
        int row = i / 3;
        int col = i % 3;
        grid->addWidget(m_btns[i], row, col);
        connect(m_btns[i], &QPushButton::clicked, this, [this, i]{ emit alignRequested(i); });
    }
    layout->addWidget(alignBox);

    // Distribute section
    auto* distBox = new QGroupBox("Distribute");
    auto* distLayout = new QGridLayout(distBox);
    m_distH = new QPushButton("Horizontal");
    m_distV = new QPushButton("Vertical");
    distLayout->addWidget(m_distH, 0, 0);
    distLayout->addWidget(m_distV, 0, 1);
    connect(m_distH, &QPushButton::clicked, this, [this]{ emit distributeRequested(0); });
    connect(m_distV, &QPushButton::clicked, this, [this]{ emit distributeRequested(1); });
    layout->addWidget(distBox);

    layout->addStretch();
    setWidget(content);
    setHasMultipleSelection(false);
}

void AlignPanel::setHasMultipleSelection(bool has) {
    for (auto* b : m_btns) b->setEnabled(has);
    m_distH->setEnabled(has);
    m_distV->setEnabled(has);
}
