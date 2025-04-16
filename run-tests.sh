#!/bin/bash

# Script to run all tests in the project

set -e  # Exit on any error

echo "Running tests for all services..."

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests for a service
run_test() {
    local service=$1
    echo -e "${YELLOW}Testing ${service} service...${NC}"
    
    if [ -d "services/${service}" ]; then
        cd "services/${service}"
        
        if [ -f "package.json" ]; then
            echo "Running npm test..."
            if npm test; then
                echo -e "${GREEN}✓ ${service} tests passed${NC}"
                cd ../..
                return 0
            else
                echo -e "${RED}✗ ${service} tests failed${NC}"
                cd ../..
                return 1
            fi
        else
            echo -e "${YELLOW}No package.json found in ${service}, skipping...${NC}"
            cd ../..
            return 0
        fi
    else
        echo -e "${YELLOW}Service directory ${service} not found, skipping...${NC}"
        return 0
    fi
}

# Array of services to test
services=("auth" "backend" "payment" "user")

# Track overall success
overall_success=true

# Run tests for each service
for service in "${services[@]}"; do
    if ! run_test "$service"; then
        overall_success=false
    fi
done

# Final output
if [ "$overall_success" = true ]; then
    echo -e "\n${GREEN}All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please check the output above.${NC}"
    exit 1
fi
