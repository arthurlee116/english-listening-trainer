#!/bin/bash

# Connect to remote server and run commands
SERVER="ubuntu@49.234.30.246"
PASSWORD="Abcd.1234"

# Install sshpass if not installed
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass..."
    brew install sshpass 2>/dev/null || sudo apt-get install -y sshpass 2>/dev/null || {
        echo "Failed to install sshpass. Please install it manually."
        exit 1
    }
fi

# Add server to known hosts if not already added
ssh-keyscan -H 49.234.30.246 2>/dev/null >> ~/.ssh/known_hosts

# Function to run remote command
run_remote() {
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
}

# Export function for use in other scripts
export -f run_remote
export SERVER
export PASSWORD