#!/usr/bin/env bash
# NodeMind Installation Script

set -e

echo "🚀 Welcome to NodeMind Installer"
echo "========================================="

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is required but not installed."
    echo "Please install Python 3.9+ and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Found Python $PYTHON_VERSION"

# 2. Check Pip
if ! command -v pip3 &> /dev/null && ! python3 -m pip --version &> /dev/null; then
    echo "❌ Error: pip is required but not installed."
    exit 1
fi
echo "✅ Found pip"

# 3. Install Package
echo "📦 Installing NodeMind via pip..."
# To switch to PyPI after publishing, change the variable below to "nodemind"
PACKAGE_SOURCE="git+https://github.com/gummybearansh/NodeMind.git"
python3 -m pip install "$PACKAGE_SOURCE"

echo "========================================="
echo "🎉 NodeMind installed successfully!"
echo ""
echo "Next Steps:"
echo "  1. Run 'nodemind init' to create your workspace."
echo "  2. Edit the generated .env file to add your API keys."
echo "  3. Run 'nodemind doctor' to ensure all system requirements are met."
echo "  4. Run 'nodemind start' to launch the system."
echo ""
echo "Happy coding! 🚀"
