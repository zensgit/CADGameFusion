#pragma once

#include <QDockWidget>
#include <QVariant>
#include <memory>

QT_BEGIN_NAMESPACE
class QTreeWidget;
class QTreeWidgetItem;
QT_END_NAMESPACE

namespace CADGame {

class PropertyItem;

/**
 * Property Panel - displays and edits properties of selected objects
 */
class PropertyPanel : public QDockWidget {
    Q_OBJECT

public:
    explicit PropertyPanel(QWidget* parent = nullptr);
    ~PropertyPanel();

    // Property structure
    struct Property {
        QString name;
        QString category;
        QVariant value;
        QVariant::Type type;
        bool readOnly = false;
        QVariant min;
        QVariant max;
        QStringList enumValues;
    };

    // Clear all properties
    void clearProperties();

    // Add a property category
    void addCategory(const QString& name);

    // Add a property
    void addProperty(const Property& property);

    // Add common property types
    void addStringProperty(const QString& category, const QString& name,
                          const QString& value, bool readOnly = false);
    void addIntProperty(const QString& category, const QString& name,
                       int value, int min = INT_MIN, int max = INT_MAX,
                       bool readOnly = false);
    void addDoubleProperty(const QString& category, const QString& name,
                          double value, double min = -DBL_MAX, double max = DBL_MAX,
                          bool readOnly = false);
    void addBoolProperty(const QString& category, const QString& name,
                        bool value, bool readOnly = false);
    void addEnumProperty(const QString& category, const QString& name,
                        const QStringList& values, int currentIndex,
                        bool readOnly = false);

    // Get property value
    QVariant getPropertyValue(const QString& name) const;

    // Set property value
    void setPropertyValue(const QString& name, const QVariant& value);

    // Batch update (no signals during update)
    void beginUpdate();
    void endUpdate();

public slots:
    // Update properties from selection
    void updateFromSelection();

    // Refresh display
    void refresh();

signals:
    // Property changed by user
    void propertyChanged(const QString& name, const QVariant& oldValue,
                        const QVariant& newValue);

    // Multiple properties changed
    void propertiesChanged();

private slots:
    void onItemChanged(QTreeWidgetItem* item, int column);
    void onItemDoubleClicked(QTreeWidgetItem* item, int column);

private:
    void setupUI();
    QTreeWidgetItem* findOrCreateCategory(const QString& category);
    PropertyItem* findProperty(const QString& name) const;
    void updateItemFromProperty(QTreeWidgetItem* item, const Property& property);

    QTreeWidget* m_treeWidget;
    QMap<QString, QTreeWidgetItem*> m_categories;
    QMap<QString, std::unique_ptr<PropertyItem>> m_properties;
    bool m_updating = false;
};

} // namespace CADGame