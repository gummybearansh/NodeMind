import sys
import os
import argparse
import threading
import time
import socket
import subprocess
import uvicorn
import shutil
import getpass
import dotenv

from backend.tui.app import NodeMindTUI
from backend.observer.watcher import BrainWatcher
from backend.core.config import settings

def check_port(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0

def check_command(cmd_name):
    return shutil.which(cmd_name) is not None

def run_server():
    # Uvicorn handles its own asyncio loop
    uvicorn.run("backend.api.server:app", host="0.0.0.0", port=8000, log_level="error")

def run_setup_wizard():
    """Interactively guide the user to configure required environment variables."""
    cwd = os.getcwd()
    env_path = os.path.join(cwd, ".env")
    
    print("\n" + "="*50)
    print("🌟 NodeMind Setup Wizard")
    print("="*50)
    print("Let's configure your environment. This will only take a minute.\n")

    # 1. MongoDB URL
    current_mongo = os.getenv("MONGO_DB_URL", "mongodb://localhost:27017")
    print("🔗 MongoDB Connection URL")
    print("   Explanation: This is where NodeMind stores your graph memory (nodes and edges).")
    print(f"   Current: {current_mongo}")
    mongo_url = input("   Enter new URL (or press Enter to keep): ").strip()
    if mongo_url:
        dotenv.set_key(env_path, "MONGO_DB_URL", mongo_url)
        os.environ["MONGO_DB_URL"] = mongo_url
        print("   ✅ Updated MONGO_DB_URL.")
    else:
        # If .env doesn't exist, we must set a default
        if not os.path.exists(env_path):
            dotenv.set_key(env_path, "MONGO_DB_URL", current_mongo)
        print("   ℹ️ Keeping existing MONGO_DB_URL.")

    # 2. Gemini API Key
    print("\n🔑 Gemini API Key")
    print("   Explanation: Required for the AI Agent Swarm (Project Manager, Engineers, etc).")
    print("   You can get one for free at: https://aistudio.google.com/app/apikey")
    
    existing_key = os.getenv("GEMINI_API_KEY", "")
    has_key = bool(existing_key and existing_key != "your_gemini_api_key_here")
    
    if has_key:
        print("   ✅ An API key is already configured.")
        change_key = input("   Do you want to update it? (y/N): ").lower()
        if change_key != 'y':
            print("   ℹ️ Keeping existing API key.")
        else:
            has_key = False # Force re-prompt
    
    if not has_key:
        while True:
            gemini_key = getpass.getpass("   Enter your Gemini API Key: ").strip()
            if gemini_key:
                dotenv.set_key(env_path, "GEMINI_API_KEY", gemini_key)
                os.environ["GEMINI_API_KEY"] = gemini_key
                print("   ✅ API key saved successfully.")
                break
            else:
                print("   ⚠️ Gemini API Key is required. Please try again.")

    # 3. Extra Config defaults if missing
    if not os.getenv("CHROMA_PERSIST_DIR"):
        dotenv.set_key(env_path, "CHROMA_PERSIST_DIR", "./.chroma")

    print("\n✅ Configuration complete! Settings saved to .env")
    print("="*50 + "\n")

def cmd_init(args):
    """Initialize NodeMind project structure and workspace."""
    cwd = os.getcwd()
    brain_dir = os.path.join(cwd, ".brain")
    
    # 1. Workspace folder
    if not os.path.exists(brain_dir):
        os.makedirs(brain_dir)
        print(f"✅ Created workspace directory: {brain_dir}")
    else:
        print(f"ℹ️ Workspace directory already exists.")

    # 2. Setup Wizard
    run_setup_wizard()
    
    print("NodeMind initialized successfully! You can now run `nodemind start`.")

def cmd_doctor(args):
    """Check system dependencies."""
    print("🏥 NodeMind Doctor: Checking system requirements...")
    
    # 1. Python check
    print(f"✅ Python: {sys.version.split(' ')[0]}")
    
    # 2. Node check
    if check_command("node"):
        try:
            node_v = subprocess.check_output(["node", "-v"], stderr=subprocess.STDOUT).decode().strip()
            print(f"✅ Node.js: {node_v}")
        except Exception:
            print("⚠️ Node.js: Found but could not execute.")
    else:
        print("⚠️ Node.js: Not found (Needed for frontend).")

    if check_command("npm"):
        print("✅ npm: Installed.")
    else:
        print("⚠️ npm: Not found.")

    # 3. MongoDB check
    # Try parsing host/port from MONGO_DB_URL if it's local
    mongo_url = os.getenv("MONGO_DB_URL", "mongodb://localhost:27017")
    if "localhost" in mongo_url or "127.0.0.1" in mongo_url:
        if check_port("127.0.0.1", 27017):
            print("✅ MongoDB: Running on port 27017.")
        else:
            print("❌ MongoDB: NOT running on port 27017.")
            print("   Please start MongoDB locally or configure a remote MONGO_DB_URL in .env.")
    else:
        print(f"ℹ️ MongoDB: Configured remotely ({mongo_url}).")

    # 4. API Key check
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key and gemini_key != "your_gemini_api_key_here":
        print("✅ Gemini API Key: Configured.")
    else:
        print("❌ Gemini API Key: Missing or invalid in .env.")

    print("\nDoctor check complete.")

def cmd_start(args):
    """Start the NodeMind backend and TUI."""
    global settings
    # 1. Configuration Check
    if not settings.is_configured():
        print("⚠️ NodeMind is not fully configured.")
        run_setup_wizard()
        # Reload settings after setup
        from backend.core.config import Settings
        settings = Settings()

    cwd = os.getcwd()
    brain_dir = os.path.join(cwd, ".brain")
    
    if not os.path.exists(brain_dir):
        print("❌ `.brain` directory not found. Please run `nodemind init` first.")
        sys.exit(1)
        
    print("==================================================")
    print("🚀 Starting NodeMind Backend...")
    print("==================================================")
    print("FRONTEND INSTRUCTIONS:")
    print("To run the interactive web interface, please open a fresh terminal:")
    print(" 1. git clone https://github.com/gummybearansh/NodeMind.git")
    print(" 2. cd NodeMind/frontend")
    print(" 3. npm install && npm run dev")
    print("==================================================")
    print("Starting Textual UI in 3 seconds... (Do not close this terminal)")
    time.sleep(3)

    # 1. Start Watchdog Observer
    watcher = BrainWatcher(brain_dir, loop=None) 
    watcher.start()
    
    # 2. Start FastAPI server asynchronously in background
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # 3. Start Textual App blockingly in main thread
    app = NodeMindTUI()
    app.run()
    
    # 4. Graceful Cleanup after TUI closes
    watcher.stop()
    print("NodeMind shutdown gracefully.")

def main():
    parser = argparse.ArgumentParser(description="NodeMind CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Init
    init_parser = subparsers.add_parser("init", aliases=["setup"], help="Initialize NodeMind in current directory")
    init_parser.set_defaults(func=cmd_init)

    # Doctor
    doctor_parser = subparsers.add_parser("doctor", help="Check system readiness")
    doctor_parser.set_defaults(func=cmd_doctor)

    # Start
    start_parser = subparsers.add_parser("start", help="Start the NodeMind system")
    start_parser.set_defaults(func=cmd_start)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
    else:
        args.func(args)

if __name__ == "__main__":
    main()
