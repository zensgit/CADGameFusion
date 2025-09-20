#!/bin/bash

# Create Project Board Script for CADGameFusion
# This script creates a new GitHub Project board and adds Issue #49

set -e

echo "🚀 Creating CADGF Project Board..."

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
    echo "❌ GitHub CLI not authenticated. Please run 'gh auth login' first."
    exit 1
fi

# Get user ID
USER_ID=$(gh api graphql -f query='query { viewer { id } }' --jq '.data.viewer.id')
echo "✅ User ID: $USER_ID"

# Check current scopes
echo "🔍 Checking current token scopes..."
gh auth status

echo ""
echo "⚠️  To create projects, you need to add project scopes to your token."
echo "📝 Please run the following commands:"
echo ""
echo "1. Generate a new token with project scopes:"
echo "   gh auth refresh -s project,read:project --hostname github.com"
echo ""
echo "2. Or manually create the project at:"
echo "   https://github.com/zensgit/CADGameFusion/projects"
echo ""
echo "3. Then run this script again to add Issue #49 to the board"

# Function to create project (requires project scope)
create_project() {
    echo "🎯 Creating project board..."
    
    PROJECT_RESULT=$(gh api graphql -f query='
    mutation {
      createProjectV2(input: {
        ownerId: "'$USER_ID'"
        title: "CADGF – CI & Design Sprint Board"
      }) {
        projectV2 {
          id
          title
          url
          number
        }
      }
    }')
    
    PROJECT_ID=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.id')
    PROJECT_URL=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.url')
    PROJECT_NUMBER=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.number')
    
    echo "✅ Project created: $PROJECT_URL"
    echo "📋 Project ID: $PROJECT_ID"
    echo "📊 Project Number: $PROJECT_NUMBER"
    
    return 0
}

# Function to add status field and create columns
setup_project_columns() {
    local project_id="$1"
    
    echo "🏗️  Setting up project columns..."
    
    # Add Status field (single select)
    STATUS_FIELD_RESULT=$(gh api graphql -f query='
    mutation {
      createProjectV2Field(input: {
        projectId: "'$project_id'"
        dataType: SINGLE_SELECT
        name: "Status"
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField {
            id
            name
          }
        }
      }
    }')
    
    STATUS_FIELD_ID=$(echo "$STATUS_FIELD_RESULT" | jq -r '.data.createProjectV2Field.projectV2Field.id')
    echo "✅ Status field created: $STATUS_FIELD_ID"
    
    # Create status options
    create_status_option() {
        local option_name="$1"
        local option_color="$2"
        
        gh api graphql -f query='
        mutation {
          createProjectV2FieldOption(input: {
            fieldId: "'$STATUS_FIELD_ID'"
            name: "'$option_name'"
            color: '$option_color'
          }) {
            projectV2FieldOption {
              id
              name
            }
          }
        }' >/dev/null
        
        echo "  ✅ Created option: $option_name"
    }
    
    create_status_option "Backlog" "GRAY"
    create_status_option "In Progress" "YELLOW" 
    create_status_option "Review" "BLUE"
    create_status_option "Done" "GREEN"
}

# Function to add issue to project
add_issue_to_project() {
    local project_id="$1"
    local issue_number="49"
    
    echo "📝 Adding Issue #$issue_number to project..."
    
    # Get issue ID
    ISSUE_ID=$(gh api repos/zensgit/CADGameFusion/issues/$issue_number --jq '.node_id')
    echo "  🔍 Issue ID: $ISSUE_ID"
    
    # Add issue to project
    ITEM_RESULT=$(gh api graphql -f query='
    mutation {
      addProjectV2ItemById(input: {
        projectId: "'$project_id'"
        contentId: "'$ISSUE_ID'"
      }) {
        item {
          id
        }
      }
    }')
    
    ITEM_ID=$(echo "$ITEM_RESULT" | jq -r '.data.addProjectV2ItemById.item.id')
    echo "  ✅ Issue added to project: $ITEM_ID"
    
    # Set status to "In Progress"
    # First get the status field and "In Progress" option IDs
    PROJECT_FIELDS=$(gh api graphql -f query='
    query {
      node(id: "'$project_id'") {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }')
    
    STATUS_FIELD_ID=$(echo "$PROJECT_FIELDS" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .id')
    IN_PROGRESS_OPTION_ID=$(echo "$PROJECT_FIELDS" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')
    
    if [ "$IN_PROGRESS_OPTION_ID" != "null" ] && [ "$IN_PROGRESS_OPTION_ID" != "" ]; then
        gh api graphql -f query='
        mutation {
          updateProjectV2ItemFieldValue(input: {
            projectId: "'$project_id'"
            itemId: "'$ITEM_ID'"
            fieldId: "'$STATUS_FIELD_ID'"
            value: {
              singleSelectOptionId: "'$IN_PROGRESS_OPTION_ID'"
            }
          }) {
            projectV2Item {
              id
            }
          }
        }' >/dev/null
        
        echo "  ✅ Issue status set to 'In Progress'"
    fi
    
    return 0
}

# Check if we have project scope
if gh api graphql -f query='query { viewer { login } }' 2>/dev/null | grep -q "INSUFFICIENT_SCOPES"; then
    echo "❌ Missing project scopes. Please refresh your authentication."
    exit 1
fi

# Main execution
echo "🎯 Attempting to create project with current token..."

# Try to create project
if PROJECT_RESULT=$(gh api graphql -f query='
mutation {
  createProjectV2(input: {
    ownerId: "'$USER_ID'"
    title: "CADGF – CI & Design Sprint Board"
  }) {
    projectV2 {
      id
      title
      url
      number
    }
  }
}' 2>/dev/null); then
    
    PROJECT_ID=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.id')
    PROJECT_URL=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.url')
    PROJECT_NUMBER=$(echo "$PROJECT_RESULT" | jq -r '.data.createProjectV2.projectV2.number')
    
    echo "✅ Project created successfully!"
    echo "🔗 URL: $PROJECT_URL"
    echo "📊 Number: $PROJECT_NUMBER"
    
    # Setup columns
    setup_project_columns "$PROJECT_ID"
    
    # Add Issue #49
    add_issue_to_project "$PROJECT_ID"
    
    echo ""
    echo "🎉 Project board setup complete!"
    echo "🔗 Access your board at: $PROJECT_URL"
    echo "📝 Issue #49 has been added to 'In Progress' column"
    
else
    echo "❌ Failed to create project. Missing project scope."
    echo ""
    echo "📋 Manual setup instructions:"
    echo "1. Go to: https://github.com/users/zensgit/projects"
    echo "2. Click 'New project'"
    echo "3. Choose 'Board' template"
    echo "4. Name: 'CADGF – CI & Design Sprint Board'"
    echo "5. Add Issue #49 from zensgit/CADGameFusion"
    echo "6. Move it to 'In Progress' column"
fi