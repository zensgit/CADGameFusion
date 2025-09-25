#pragma once

#include <QObject>
#include <QString>
#include <QJsonDocument>
#include <QJsonObject>
#include <memory>

namespace CADGame {

/**
 * Project class - manages CADGameFusion project files
 */
class Project : public QObject {
    Q_OBJECT

public:
    explicit Project(QObject* parent = nullptr);
    ~Project();

    // Project state
    bool isModified() const { return m_modified; }
    bool hasFilePath() const { return !m_filePath.isEmpty(); }
    QString filePath() const { return m_filePath; }
    QString projectName() const;

    // File operations
    bool newProject();
    bool open(const QString& filePath);
    bool save();
    bool saveAs(const QString& filePath);
    bool close();

    // Project data access
    QJsonObject projectData() const { return m_data; }
    void setProjectData(const QJsonObject& data);

    // Metadata
    QString version() const;
    QDateTime lastModified() const;
    QString author() const;
    void setAuthor(const QString& author);

    // Scene data
    QJsonObject sceneData() const;
    void setSceneData(const QJsonObject& scene);

    // Settings
    QJsonObject settings() const;
    void setSetting(const QString& key, const QJsonValue& value);
    QJsonValue setting(const QString& key) const;

    // Export/Import
    bool exportTo(const QString& filePath, const QString& format);
    bool importFrom(const QString& filePath, const QString& format);

    // Recent files
    static QStringList recentFiles();
    static void addRecentFile(const QString& filePath);
    static void clearRecentFiles();

    // File format info
    static QString fileFilter();
    static QString defaultExtension() { return ".cgf"; }

signals:
    void projectOpened(const QString& filePath);
    void projectSaved(const QString& filePath);
    void projectClosed();
    void modifiedChanged(bool modified);
    void projectDataChanged();

protected:
    void setModified(bool modified);
    void updateMetadata();

private:
    bool loadFromFile(const QString& filePath);
    bool saveToFile(const QString& filePath);
    void initializeDefaults();

    QString m_filePath;
    bool m_modified = false;
    QJsonObject m_data;

    static constexpr const char* PROJECT_VERSION = "1.0.0";
    static constexpr const char* FILE_SIGNATURE = "CADGameFusion";
};

using ProjectPtr = std::shared_ptr<Project>;

} // namespace CADGame