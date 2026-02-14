#!/usr/bin/env python3
"""
Simple Profile Launch Test Script
"""

import os
import sys
import json
import subprocess
import time

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
    print("Checking ChromeDriver...")
    
    if not os.path.exists(CHROMEDRIVER_PATH):
        print(f"ERROR: ChromeDriver not found at: {CHROMEDRIVER_PATH}")
        return False
    
    try:
        result = subprocess.run([CHROMEDRIVER_PATH, '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"SUCCESS: ChromeDriver found: {result.stdout.strip()}")
            return True
        else:
            print(f"ERROR: ChromeDriver error: {result.stderr}")
            return False
    except Exception as e:
        print(f"ERROR: ChromeDriver test failed: {e}")
        return False

def test_profile_launch(profile_name, timeout=15):
    """Test launching a specific profile"""
    print(f"\nTesting profile launch: {profile_name}")
    
    try:
        # Start the launch process
        process = subprocess.Popen(
            ['python', 'manager.py', 'launch', '--name', profile_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        print(f"Process started with PID: {process.pid}")
        
        # Wait a bit for the process to initialize
        time.sleep(8)
        
        # Check if process is still running
        if process.poll() is None:
            print("SUCCESS: Process is running")
            
            # Terminate the test process
            try:
                process.terminate()
                process.wait(timeout=5)
                print("SUCCESS: Test process terminated")
            except subprocess.TimeoutExpired:
                process.kill()
                print("WARNING: Test process killed (timeout)")
            
            return True
            
        else:
            # Process ended, check output
            stdout, stderr = process.communicate()
            print(f"ERROR: Process ended with code: {process.returncode}")
            if stdout:
                print(f"STDOUT: {stdout}")
            if stderr:
                print(f"STDERR: {stderr}")
            return False
            
    except Exception as e:
        print(f"ERROR: Launch test failed: {e}")
        return False

def main():
    """Main test function"""
    print("Browser Profile Launch Test")
    print("=" * 40)
    
    # Check basic requirements
    if not check_chromedriver():
        print("\nERROR: ChromeDriver check failed")
        return False
    
    # Load profiles and test one
    profiles = load_profiles()
    if not profiles:
        print("\nERROR: No profiles available for testing")
        return False
    
    print(f"\nFound {len(profiles)} profiles")
    
    # Test the first profile
    first_profile = list(profiles.keys())[0]
    print(f"Testing first available profile: {first_profile}")
    
    success = test_profile_launch(first_profile)
    
    if success:
        print("\nSUCCESS: Profile launch test PASSED")
        print("Profiles should be working correctly")
    else:
        print("\nERROR: Profile launch test FAILED")
        print("Check the error messages above for troubleshooting")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)