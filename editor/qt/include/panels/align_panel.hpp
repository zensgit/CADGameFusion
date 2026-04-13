#pragma once

#include <QDockWidget>

class QPushButton;

class AlignPanel : public QDockWidget {
    Q_OBJECT
public:
    // Align types: 0=Left, 1=CenterH, 2=Right, 3=Top, 4=CenterV, 5=Bottom
    enum AlignType { Left=0, CenterH, Right, Top, CenterV, Bottom };

    explicit AlignPanel(QWidget* parent = nullptr);
    void setHasMultipleSelection(bool has);

signals:
    void alignRequested(int alignType);
    void distributeRequested(int axis); // 0=horizontal, 1=vertical

private:
    QPushButton* m_btns[6]{};
    QPushButton* m_distH{nullptr};
    QPushButton* m_distV{nullptr};
};
