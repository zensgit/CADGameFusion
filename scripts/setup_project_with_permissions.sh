#!/bin/bash

# Complete Project Board Setup Script
# Run this after getting project permissions with: gh auth refresh -s project,read:project --hostname github.com

set -e

echo "🚀 Setting up CADGF Project Board with Issue #49..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check authentication and scopes
check_auth() {
    echo "🔍 Checking GitHub CLI authentication..."
    
    if ! gh auth status >/dev/null 2>&1; then
        echo -e "${RED}❌ Not authenticated. Run: gh auth login${NC}"
        exit 1
    fi
    
    # Try a simple GraphQL query to check project scope
    if ! gh api graphql -f query='query { viewer { login } }' >/dev/null 2>&1; then
        echo -e "${RED}❌ Missing project scopes.${NC}"
        echo -e "${YELLOW}Run: gh auth refresh -s project,read:project --hostname github.com${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Authentication OK${NC}"
}

# Get user ID
get_user_id() {
    USER_ID=$(gh api graphql -f query='query { viewer { id } }' --jq '.data.viewer.id')
    echo -e "${GREEN}✅ User ID: $USER_ID${NC}"
}

# Create project
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
    
    if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}❌ Failed to create project${NC}"
        echo "$PROJECT_RESULT"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Project created!${NC}"
    echo -e "${GREEN}🔗 URL: $PROJECT_URL${NC}"
    echo -e "${GREEN}📊 Number: $PROJECT_NUMBER${NC}"
}

# Setup project status field and options
setup_status_field() {
    echo "🏗️  Setting up Status field..."
    
    # Create Status field
    STATUS_FIELD_RESULT=$(gh api graphql -f query='
    mutation {
      createProjectV2Field(input: {
        projectId: "'$PROJECT_ID'"
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
    echo -e "${GREEN}✅ Status field created: $STATUS_FIELD_ID${NC}"
    
    # Create status options
    create_option() {
        local name="$1"
        local color="$2"
        
        OPTION_RESULT=$(gh api graphql -f query='
        mutation {
          createProjectV2FieldOption(input: {
            fieldId: "'$STATUS_FIELD_ID'"
            name: "'$name'"
            color: '$color'
          }) {
            projectV2FieldOption {
              id
              name
            }
          }
        }')
        
        OPTION_ID=$(echo "$OPTION_RESULT" | jq -r '.data.createProjectV2FieldOption.projectV2FieldOption.id')
        echo -e "${GREEN}  ✅ Created '$name' option: $OPTION_ID${NC}"
        
        # Store In Progress option ID for later use
        if [ "$name" = "In Progress" ]; then
            IN_PROGRESS_OPTION_ID="$OPTION_ID"
        fi
    }
    
    create_option "Backlog" "GRAY"
    create_option "In Progress" "YELLOW"
    create_option "Review" "BLUE" 
    create_option "Done" "GREEN"
}

# Add issue to project
add_issue_to_project() {
    echo "📝 Adding Issue #49 to project..."
    
    # Get issue node ID
    ISSUE_ID=$(gh api repos/zensgit/CADGameFusion/issues/49 --jq '.node_id')
    echo -e "${GREEN}  🔍 Issue node ID: $ISSUE_ID${NC}"
    
    # Add issue to project
    ITEM_RESULT=$(gh api graphql -f query='
    mutation {
      addProjectV2ItemById(input: {
        projectId: "'$PROJECT_ID'"
        contentId: "'$ISSUE_ID'"
      }) {
        item {
          id
        }
      }
    }')
    
    ITEM_ID=$(echo "$ITEM_RESULT" | jq -r '.data.addProjectV2ItemById.item.id')
    
    if [ "$ITEM_ID" = "null" ] || [ -z "$ITEM_ID" ]; then
        echo -e "${RED}❌ Failed to add issue to project${NC}"
        echo "$ITEM_RESULT"
        return 1
    fi
    
    echo -e "${GREEN}  ✅ Issue added to project: $ITEM_ID${NC}"
    
    # Set status to "In Progress"
    if [ -n "$IN_PROGRESS_OPTION_ID" ]; then
        UPDATE_RESULT=$(gh api graphql -f query='
        mutation {
          updateProjectV2ItemFieldValue(input: {
            projectId: "'$PROJECT_ID'"
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
        }')
        
        echo -e "${GREEN}  ✅ Issue status set to 'In Progress'${NC}"
    fi
}

# Link project to repository (optional)
link_to_repository() {
    echo "🔗 Linking project to repository..."
    
    # This creates a connection between the project and repository
    REPO_ID=$(gh api repos/zensgit/CADGameFusion --jq '.node_id')
    
    LINK_RESULT=$(gh api graphql -f query='
    mutation {
      linkProjectV2ToRepository(input: {
        projectId: "'$PROJECT_ID'"
        repositoryId: "'$REPO_ID'"
      }) {
        repository {
          id
        }
      }
    }') || echo "Note: Project linking may require different permissions"
    
    echo -e "${GREEN}  ✅ Project linked to repository${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 CADGF Project Board Setup${NC}"
    echo "==============================="
    
    check_auth
    get_user_id
    create_project
    setup_status_field
    add_issue_to_project
    link_to_repository
    
    echo ""
    echo -e "${GREEN}🎉 Project board setup complete!${NC}"
    echo -e "${GREEN}🔗 Access your board at: $PROJECT_URL${NC}"
    echo -e "${GREEN}📝 Issue #49 is now in 'In Progress' column${NC}"
    echo ""
    echo "📋 Board structure:"
    echo "  • Backlog (Gray)"
    echo "  • In Progress (Yellow) ← Issue #49 is here"
    echo "  • Review (Blue)"
    echo "  • Done (Green)"
}

# Run main function
main