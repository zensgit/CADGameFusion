#include "export_dialog.hpp"
#include "core/document.hpp"

#include <QCheckBox>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QPushButton>
#include <QSettings>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QJsonDocument>
#include <QJsonObject>
#include <QClipboard>
#include <QApplication>
#include <QDesktopServices>
#include <QUrl>
#include <QFileInfo>
#include <QDir>
#include <QTextStream>

QJsonObject ExportDialog::ExportOptions::toJson() const {
    QJsonObject json;
    json["format"] = format;
    json["range"] = static_cast<int>(range);
    json["includeHoles"] = includeHoles;
    json["exportRingRoles"] = exportRingRoles;
    json["joinType"] = static_cast<int>(joinType);
    json["miterLimit"] = miterLimit;
    json["useDocUnit"] = useDocUnit;
    json["unitScale"] = unitScale;
    return json;
}

ExportDialog::ExportOptions ExportDialog::ExportOptions::fromJson(const QJsonObject& json) {
    ExportOptions opts;
    opts.format = json["format"].toString("json");
    opts.range = static_cast<ExportRange>(json["range"].toInt(0));
    opts.includeHoles = json["includeHoles"].toBool(true);
    opts.exportRingRoles = json["exportRingRoles"].toBool(false);
    opts.joinType = static_cast<JoinType>(json["joinType"].toInt(0));
    opts.miterLimit = json["miterLimit"].toDouble(2.0);
    opts.useDocUnit = json["useDocUnit"].toBool(true);
    opts.unitScale = json["unitScale"].toDouble(1.0);
    return opts;
}

ExportDialog::ExportDialog(QWidget* parent)
    : QDialog(parent)
    , m_document(nullptr)
    , m_selectedGroup(-1)
    , m_settings(std::make_unique<QSettings>("CADGameFusion", "ExportDialog"))
{
    setWindowTitle(tr("Export Options"));
    setModal(true);
    setupUI();
    loadSettings();
}

ExportDialog::~ExportDialog() {
    saveSettings();
}

void ExportDialog::setupUI() {
    auto* mainLayout = new QVBoxLayout(this);
    
    // Form layout for options
    m_formLayout = new QFormLayout();
    
    // Format selection
    m_formatCombo = new QComboBox(this);
    m_formatCombo->addItems({"json", "gltf", "unity"});
    m_formLayout->addRow(tr("Format:"), m_formatCombo);
    
    // Export range
    m_rangeCombo = new QComboBox(this);
    m_rangeCombo->addItem(tr("All Groups"), static_cast<int>(AllGroups));
    m_rangeCombo->addItem(tr("Selected Group Only"), static_cast<int>(SelectedGroupOnly));
    m_formLayout->addRow(tr("Export Range:"), m_rangeCombo);
    
    // Holes option
    m_holesCheck = new QCheckBox(tr("Include holes in triangulation"), this);
    m_holesCheck->setChecked(true);
    m_formLayout->addRow(m_holesCheck);
    
    // Ring roles option (for JSON)
    m_ringRolesCheck = new QCheckBox(tr("Export ring roles metadata"), this);
    m_formLayout->addRow(m_ringRolesCheck);
    
    // Offset options (for future use)
    auto* offsetLabel = new QLabel(tr("<b>Offset Options (for metadata):</b>"), this);
    m_formLayout->addRow(offsetLabel);
    
    // Join type
    m_joinTypeCombo = new QComboBox(this);
    m_joinTypeCombo->addItem(tr("Miter"), static_cast<int>(Miter));
    m_joinTypeCombo->addItem(tr("Round"), static_cast<int>(Round));
    m_joinTypeCombo->addItem(tr("Bevel"), static_cast<int>(Bevel));
    m_formLayout->addRow(tr("Join Type:"), m_joinTypeCombo);
    
    // Miter limit
    m_miterLimitSpin = new QDoubleSpinBox(this);
    m_miterLimitSpin->setRange(1.0, 10.0);
    m_miterLimitSpin->setSingleStep(0.5);
    m_miterLimitSpin->setValue(2.0);
    m_miterLimitSpin->setDecimals(1);
    m_formLayout->addRow(tr("Miter Limit:"), m_miterLimitSpin);

    // Unit scale options
    m_useDocUnitCheck = new QCheckBox(tr("Use document unit scale"), this);
    m_useDocUnitCheck->setChecked(true);
    m_formLayout->addRow(m_useDocUnitCheck);
    m_unitScaleSpin = new QDoubleSpinBox(this);
    m_unitScaleSpin->setRange(1e-6, 1e6);
    m_unitScaleSpin->setDecimals(6);
    m_unitScaleSpin->setValue(1.0);
    m_formLayout->addRow(tr("Unit Scale:"), m_unitScaleSpin);
    
    mainLayout->addLayout(m_formLayout);
    
    // Action buttons
    auto* actionLayout = new QHBoxLayout();
    
    m_openDirButton = new QPushButton(tr("Open Export Directory"), this);
    m_openDirButton->setEnabled(false);
    actionLayout->addWidget(m_openDirButton);
    
    m_copyReportButton = new QPushButton(tr("Copy Report"), this);
    actionLayout->addWidget(m_copyReportButton);
    
    actionLayout->addStretch();
    mainLayout->addLayout(actionLayout);
    
    // Dialog buttons
    m_buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    mainLayout->addWidget(m_buttonBox);
    
    // Connections
    connect(m_formatCombo, &QComboBox::currentTextChanged,
            this, &ExportDialog::onFormatChanged);
    connect(m_joinTypeCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            [this](int) { updateUIState(); });
    connect(m_openDirButton, &QPushButton::clicked,
            this, &ExportDialog::onOpenDirectory);
    connect(m_copyReportButton, &QPushButton::clicked,
            this, &ExportDialog::onCopyReport);
    connect(m_buttonBox, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(m_buttonBox, &QDialogButtonBox::rejected, this, &QDialog::reject);
    connect(m_useDocUnitCheck, &QCheckBox::toggled, [this](bool){ updateUIState(); });
    
    updateUIState();
}

void ExportDialog::setDocument(const core::Document* doc, int selectedGroup) {
    m_document = doc;
    m_selectedGroup = selectedGroup;
    
    // Update range combo based on selection
    if (selectedGroup >= 0) {
        m_rangeCombo->setCurrentIndex(1); // Default to selected group
        m_rangeCombo->setEnabled(true);
    } else {
        m_rangeCombo->setCurrentIndex(0); // All groups
        m_rangeCombo->setEnabled(false);
    }
    
    updateUIState();
}

ExportDialog::ExportOptions ExportDialog::getOptions() const {
    ExportOptions opts;
    opts.format = m_formatCombo->currentText();
    opts.range = static_cast<ExportRange>(m_rangeCombo->currentData().toInt());
    opts.includeHoles = m_holesCheck->isChecked();
    opts.exportRingRoles = m_ringRolesCheck->isChecked();
    opts.joinType = static_cast<JoinType>(m_joinTypeCombo->currentData().toInt());
    opts.miterLimit = m_miterLimitSpin->value();
    opts.useDocUnit = m_useDocUnitCheck->isChecked();
    opts.unitScale = m_unitScaleSpin->value();
    return opts;
}

void ExportDialog::onFormatChanged(const QString& format) {
    // Show/hide format-specific options
    bool isJson = (format == "json");
    m_ringRolesCheck->setVisible(isJson);
    
    // Holes option is relevant for glTF/Unity
    bool needs3D = (format == "gltf" || format == "unity");
    m_holesCheck->setEnabled(needs3D);
    
    updateUIState();
}

void ExportDialog::onOpenDirectory() {
    if (!m_lastExportPath.isEmpty()) {
        QFileInfo info(m_lastExportPath);
        QDesktopServices::openUrl(QUrl::fromLocalFile(info.dir().absolutePath()));
    }
}

void ExportDialog::onCopyReport() {
    QString report = generateReport();
    QApplication::clipboard()->setText(report);
}

QString ExportDialog::generateReport() const {
    QString report;
    QTextStream stream(&report);
    
    stream << "=== Export Configuration Report ===" << Qt::endl;
    stream << "Format: " << m_formatCombo->currentText() << Qt::endl;
    stream << "Range: " << m_rangeCombo->currentText() << Qt::endl;
    stream << "Include Holes: " << (m_holesCheck->isChecked() ? "Yes" : "No") << Qt::endl;
    
    if (m_formatCombo->currentText() == "json") {
        stream << "Export Ring Roles: " << (m_ringRolesCheck->isChecked() ? "Yes" : "No") << Qt::endl;
    }
    
    stream << Qt::endl << "Offset Metadata:" << Qt::endl;
    stream << "  Join Type: " << m_joinTypeCombo->currentText() << Qt::endl;
    stream << "  Miter Limit: " << m_miterLimitSpin->value() << Qt::endl;
    
    // Add JSON representation
    stream << Qt::endl << "JSON Configuration:" << Qt::endl;
    QJsonDocument doc(getOptions().toJson());
    stream << doc.toJson(QJsonDocument::Indented);
    
    return report;
}

void ExportDialog::updateUIState() {
    // Enable miter limit only when join type is Miter
    bool isMiter = (m_joinTypeCombo->currentData().toInt() == static_cast<int>(Miter));
    m_miterLimitSpin->setEnabled(isMiter);
    
    // Update other UI elements as needed
    onFormatChanged(m_formatCombo->currentText());
    // Unit scale spin enabled only when not using document unit
    m_unitScaleSpin->setEnabled(!m_useDocUnitCheck->isChecked());
}

void ExportDialog::saveSettings() {
    m_settings->setValue("format", m_formatCombo->currentText());
    m_settings->setValue("includeHoles", m_holesCheck->isChecked());
    m_settings->setValue("exportRingRoles", m_ringRolesCheck->isChecked());
    m_settings->setValue("joinType", m_joinTypeCombo->currentIndex());
    m_settings->setValue("miterLimit", m_miterLimitSpin->value());
    m_settings->setValue("lastExportPath", m_lastExportPath);
}

void ExportDialog::loadSettings() {
    m_formatCombo->setCurrentText(m_settings->value("format", "json").toString());
    m_holesCheck->setChecked(m_settings->value("includeHoles", true).toBool());
    m_ringRolesCheck->setChecked(m_settings->value("exportRingRoles", false).toBool());
    m_joinTypeCombo->setCurrentIndex(m_settings->value("joinType", 0).toInt());
    m_miterLimitSpin->setValue(m_settings->value("miterLimit", 2.0).toDouble());
    m_lastExportPath = m_settings->value("lastExportPath").toString();
    
    m_openDirButton->setEnabled(!m_lastExportPath.isEmpty());
}

bool ExportDialog::getExportOptions(QWidget* parent, 
                                   const core::Document* doc,
                                   int selectedGroup,
                                   ExportOptions& options) {
    ExportDialog dialog(parent);
    dialog.setDocument(doc, selectedGroup);
    
    if (dialog.exec() == QDialog::Accepted) {
        options = dialog.getOptions();
        return true;
    }
    return false;
}
