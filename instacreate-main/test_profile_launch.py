#!/usr/bin/env python3
"""
Profile Launch Test Script
Tests if browser profiles can be launched successfully
"""

import os
import sys
import json
import subprocess
import time
import psutil
from pathlib import Path

# Configuration
PROFILES_DIR = "./selenium_profiles"
PROFILE_CONFIG_FILE = os.path.join(PROFILES_DIR, "profiles.json")
CHROMEDRIVER_PATH = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver.exe')

def load_profiles():
    """Load profiles from JSON file"""
    if not os.path.exists(PROFILE_CONFIG_FILE):
        return {}
    try:
        with open(PROFILE_CONFIG_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def check_chromedriver():
    """Check if chromedriver exists and is executable"""
    print("🔍 Checking ChromeDriver...")
    
    if not os.path.exists(CHROMEDRIVER_PATH):
        print(f"❌ ChromeDriver not found at: {CHROMEDRIVER_PATH}")
        return False
    
    try:
        result = subprocess.run([CHROMEDRIVER_PATH, '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"✅ ChromeDriver found: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ ChromeDriver error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ ChromeDriver test failed: {e}")
        return False

def check_python_dependencies():
    """Check if required Python packages are installed"""
    print("\n🔍 Checking Python dependencies...")
    
    required_packages = [
        'undetected_chromedriver',
        'selenium',
        'psutil'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"✅ {package} - installed")
        except ImportError:
            print(f"❌ {package} - missing")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install " + " ".join(missing_packages))
        return False
    
    return True

def test_profile_launch(profile_name, timeout=30):
    """Test launching a specific profile"""
    print(f"\n🚀 Testing profile launch: {profile_name}")
    
    try:
        # Start the launch process
        process = subprocess.Popen(
            ['python', 'manager.py', 'launch', '--name', profile_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        print(f"📝 Process started with PID: {process.pid}")
        
        # Wait a bit for the process to initialize
        time.sleep(5)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ Process is running")
            
            # Look for Chrome processes
            chrome_processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if 'chrome' in proc.info['name'].lower():
                        cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                        if profile_name in cmdline or 'user-data-dir' in cmdline:
                            chrome_processes.append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            if chrome_processes:
                print(f"✅ Found {len(chrome_processes)} Chrome process(es) for profile")
                for proc in chrome_processes:
                    print(f"   - PID: {proc['pid']}, Name: {proc['name']}")
            else:
                print("⚠️  No Chrome processes found for profile")
            
            # Terminate the test process
            try:
                process.terminate()
                process.wait(timeout=10)
                print("✅ Test process terminated successfully")
            except subprocess.TimeoutExpired:
                process.kill()
                print("⚠️  Test process killed (timeout)")
            
            return True
            
        else:
            # Process ended, check output
            stdout, stderr = process.communicate()
            print(f"❌ Process ended with code: {process.returncode}")
            if stdout:
                print(f"📤 STDOUT:\n{stdout}")
            if stderr:
                print(f"📤 STDERR:\n{stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Launch test failed: {e}")
        return False

def check_profile_directories():
    """Check if profile directories exist and are properly structured"""
    print("\n🔍 Checking profile directories...")
    
    profiles = load_profiles()
    if not profiles:
        print("❌ No profiles found")
        return False
    
    print(f"📁 Found {len(profiles)} profiles")
    
    for profile_name in profiles.keys():
        profile_dir = os.path.join(PROFILES_DIR, profile_name)
        default_dir = os.path.join(profile_dir, "Default")
        
        if os.path.exists(profile_dir):
            print(f"✅ {profile_name} - directory exists")
            if os.path.exists(default_dir):
                print(f"   ✅ Default subdirectory exists")
            else:
                print(f"   ⚠️  Default subdirectory missing")
        else:
            print(f"❌ {profile_name} - directory missing")
    
    return True

def main():
    """Main test function"""
    print("🧪 Browser Profile Launch Test")
    print("=" * 50)
    
    # Check basic requirements
    if not check_chromedriver():
        print("\n❌ ChromeDriver check failed")
        return False
    
    if not check_python_dependencies():
        print("\n❌ Python dependencies check failed")
        return False
    
    if not check_profile_directories():
        print("\n❌ Profile directories check failed")
        return False
    
    # Load profiles and test one
    profiles = load_profiles()
    if not profiles:
        print("\n❌ No profiles available for testing")
        return False
    
    # Test the first profile
    first_profile = list(profiles.keys())[0]
    print(f"\n🎯 Testing first available profile: {first_profile}")
    
    success = test_profile_launch(first_profile)
    
    if success:
        print("\n✅ Profile launch test PASSED")
        print("Profiles should be working correctly")
    else:
        print("\n❌ Profile launch test FAILED")
        print("Check the error messages above for troubleshooting")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)