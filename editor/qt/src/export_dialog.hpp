#pragma once

#include <QDialog>
#include <QJsonObject>
#include <memory>

QT_BEGIN_NAMESPACE
class QCheckBox;
class QComboBox;
class QDoubleSpinBox;
class QDialogButtonBox;
class QFormLayout;
class QPushButton;
class QSettings;
class QLabel;
QT_END_NAMESPACE

namespace core {
    class Document;
}

class ExportDialog : public QDialog {
    Q_OBJECT

public:
    enum ExportRange {
        AllGroups = 0,
        SelectedGroupOnly = 1
    };

    enum JoinType {
        Miter = 0,
        Round = 1,
        Bevel = 2
    };

    struct ExportOptions {
        QString format;
        ExportRange range;
        bool includeHoles;
        bool exportRingRoles;
        JoinType joinType;
        double miterLimit;
        bool useDocUnit;
        double unitScale;
        
        // Convert to JSON for metadata
        QJsonObject toJson() const;
        static ExportOptions fromJson(const QJsonObject& json);
    };

    explicit ExportDialog(QWidget* parent = nullptr);
    ~ExportDialog();

    // Set document context
    void setDocument(const core::Document* doc, int selectedGroup);
    
    // Get configured options
    ExportOptions getOptions() const;
    
    // Static convenience method
    static bool getExportOptions(QWidget* parent, 
                                const core::Document* doc,
                                int selectedGroup,
                                ExportOptions& options);

signals:
    void openDirectoryRequested(const QString& path);
    void copyReportRequested(const QString& report);

private slots:
    void onFormatChanged(const QString& format);
    void onOpenDirectory();
    void onCopyReport();
    void saveSettings();
    void loadSettings();

private:
    void setupUI();
    void updateUIState();
    QString generateReport() const;
    
    // UI elements
    QComboBox* m_formatCombo;
    QComboBox* m_rangeCombo;
    QCheckBox* m_holesCheck;
    QCheckBox* m_ringRolesCheck;
    QComboBox* m_joinTypeCombo;
    QDoubleSpinBox* m_miterLimitSpin;
    QCheckBox* m_useDocUnitCheck;
    QDoubleSpinBox* m_unitScaleSpin;
    QLabel* m_docUnitLabel;
    QPushButton* m_openDirButton;
    QPushButton* m_copyReportButton;
    QDialogButtonBox* m_buttonBox;
    QFormLayout* m_formLayout;
    
    // Context
    const core::Document* m_document;
    int m_selectedGroup;
    QString m_lastExportPath;
    
    // Settings
    std::unique_ptr<QSettings> m_settings;
};
