import os
import json
import argparse
import sys
import time
import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.proxy import Proxy, ProxyType
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import shutil
import random
import urllib.parse

# --- CONFIGURATION ---
# Use environment variable for Docker compatibility
CHROMEDRIVER_PATH = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver')
PROFILES_DIR = "./selenium_profiles"
PROFILE_CONFIG_FILE = os.path.join(PROFILES_DIR, "profiles.json")

# Detect if running in Docker
IS_DOCKER = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_ENV') == 'true'

# List of user agents to be chosen from randomly
USER_AGENTS = [
    # Linux Chrome (for Docker compatibility)
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Windows Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # macOS Chrome
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]

# Screen resolutions (desktop focused for Docker)
SCREEN_RESOLUTIONS = [
    [1920, 1080], [1366, 768], [1536, 864], [1440, 900], [1280, 720]
]

# Languages
LANGUAGES = [
    "en-US,en;q=0.9", "en-GB,en;q=0.9", "es-ES,es;q=0.9", "fr-FR,fr;q=0.9", "de-DE,de;q=0.9"
]

# Timezones (focused on German and European zones)
TIMEZONES = [
    "Europe/Berlin", "Europe/Munich", "Europe/Hamburg", "Europe/Cologne",
    "Europe/Frankfurt", "Europe/Stuttgart", "Europe/Dusseldorf",
    "Europe/Vienna", "Europe/Zurich", "Europe/Amsterdam",
    "Europe/Paris", "Europe/London", "Europe/Rome", "Europe/Madrid"
]

# Ensure the main profiles directory exists
os.makedirs(PROFILES_DIR, exist_ok=True)

def create_proxy_auth_extension(proxy_host, proxy_port, proxy_username, proxy_password):
    """Creates a Chrome extension to handle proxy authentication automatically."""
    extension_dir = os.path.join(PROFILES_DIR, "proxy_auth_extension")
    os.makedirs(extension_dir, exist_ok=True)
    
    manifest_json = """
{
    "version": "1.0.0",
    "manifest_version": 2,
    "name": "Proxy Auth",
    "permissions": [
        "webRequest",
        "webRequestBlocking",
        "<all_urls>"
    ],
    "background": {
        "scripts": ["background.js"],
        "persistent": true
    }
}
"""
    
    background_js = f"""
chrome.webRequest.onAuthRequired.addListener(
    function(details) {{
        return {{
            authCredentials: {{
                username: "{proxy_username}",
                password: "{proxy_password}"
            }}
        }};
    }},
    {{urls: ["<all_urls>"]}},
    ["blocking"]
);
"""
    
    with open(os.path.join(extension_dir, "manifest.json"), "w") as f:
        f.write(manifest_json)
    
    with open(os.path.join(extension_dir, "background.js"), "w") as f:
        f.write(background_js)
    
    return extension_dir

def load_profiles():
    """Loads the profiles data from the JSON file."""
    if not os.path.exists(PROFILE_CONFIG_FILE):
        return {}
    try:
        with open(PROFILE_CONFIG_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_profiles(data):
    """Saves the profiles data to the JSON file."""
    with open(PROFILE_CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)

def list_profiles():
    """Prints all profile configurations as a JSON string to standard output."""
    profiles = load_profiles()
    print(json.dumps(profiles, indent=4))

def create_profile(name, config=None):
    """Creates a new profile with specified or random configuration if it doesn't exist."""
    if not name:
        print("Error: Profile name cannot be empty.", file=sys.stderr)
        sys.exit(1)
        
    profiles = load_profiles()
    
    if name in profiles:
        print(f"Info: Profile '{name}' already exists. No changes made.", file=sys.stderr)
        return

    profile_data_path = os.path.join(PROFILES_DIR, name)
    os.makedirs(profile_data_path, exist_ok=True)
    
    default_profile_path = os.path.join(profile_data_path, "Default")
    os.makedirs(default_profile_path, exist_ok=True)

    if config is None:
        config = {}
    
    profiles[name] = {
        "proxy": config.get("proxy", ""),
        "user_agent": config.get("user_agent", random.choice(USER_AGENTS)),
        "window_size": config.get("window_size", random.choice(SCREEN_RESOLUTIONS)),
        "remark": config.get("remark", ""),
        "language": config.get("language", random.choice(LANGUAGES)),
        "timezone": config.get("timezone", random.choice(TIMEZONES)),
        "webrtc": config.get("webrtc", "disabled"),
        "startup_urls": config.get("startup_urls", ["https://httpbin.org/ip"])
    }
    
    save_profiles(profiles)
    print(f"Success: New profile '{name}' was created.", file=sys.stderr)
    print(f"  - User Agent: {profiles[name]['user_agent']}", file=sys.stderr)
    print(f"  - Window Size: {profiles[name]['window_size'][0]}x{profiles[name]['window_size'][1]}", file=sys.stderr)

def launch_profile(name):
    """Launches an undetected_chromedriver instance with the specified profile."""
    profiles = load_profiles()
    
    if name not in profiles:
        print(f"Error: Profile '{name}' not found.", file=sys.stderr)
        sys.exit(1)

    profile_config = profiles[name]
    profile_data_path = os.path.abspath(os.path.join(PROFILES_DIR, name))
    
    print(f"Info: Launching profile '{name}'...", file=sys.stderr)
    
    chrome_options = Options()
    
    # Essential Docker options
    if IS_DOCKER:
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--remote-debugging-port=9222")
    
    # Profile isolation and data persistence
    chrome_options.add_argument(f"--user-data-dir={profile_data_path}")
    chrome_options.add_argument(f"--profile-directory=Default")
    
    # Essential options for data persistence
    chrome_options.add_argument("--no-first-run")
    chrome_options.add_argument("--no-default-browser-check")
    chrome_options.add_argument("--disable-default-apps")
    chrome_options.add_argument("--disable-session-crashed-bubble")
    chrome_options.add_argument("--disable-infobars")
    
    # Set user agent
    user_agent = profile_config['user_agent']
    if user_agent:
        chrome_options.add_argument(f"--user-agent={user_agent}")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    
    # Set language
    language = profile_config.get('language', 'en-US,en;q=0.9')
    chrome_options.add_argument(f"--accept-lang={language}")
    
    # WebRTC settings
    webrtc = profile_config.get('webrtc', 'disabled')
    if webrtc == 'disabled':
        chrome_options.add_argument("--disable-webrtc")
    
    # Configure proxy
    proxy = profile_config.get("proxy", "").strip()
    if proxy:
        try:
            print(f"Info: Setting up proxy: {proxy}", file=sys.stderr)
            
            if not proxy.startswith(('http://', 'https://', 'socks4://', 'socks5://')):
                proxy = f'http://{proxy}'
            
            parsed = urllib.parse.urlparse(proxy)
            
            if parsed.scheme.lower() in ['socks4', 'socks5']:
                proxy_server = f'{parsed.scheme}://{parsed.hostname}:{parsed.port}'
            else:
                proxy_server = f'{parsed.hostname}:{parsed.port}'
            
            chrome_options.add_argument(f'--proxy-server={proxy_server}')
            print(f"Info: Chrome proxy server: {proxy_server}", file=sys.stderr)
            
            if parsed.username and parsed.password:
                proxy_auth_extension = create_proxy_auth_extension(
                    parsed.hostname, parsed.port, parsed.username, parsed.password
                )
                chrome_options.add_argument(f'--load-extension={proxy_auth_extension}')
                print(f"Info: Proxy auth extension created for {parsed.username}", file=sys.stderr)
                
        except Exception as e:
            print(f"Error: Proxy setup failed: {e}", file=sys.stderr)

    try:
        print(f"Info: Using chromedriver (auto-download if needed)", file=sys.stderr)
        print(f"Info: Profile data directory: {profile_data_path}", file=sys.stderr)
        
        # Let undetected-chromedriver auto-download the correct version
        driver = uc.Chrome(
            options=chrome_options,
            use_subprocess=False
        )
        
        print(f"Info: Chrome driver initialized successfully", file=sys.stderr)
        
        # Set window size
        width, height = profile_config['window_size']
        driver.set_window_size(width, height)
        print(f"Info: Set window size to {width}x{height}", file=sys.stderr)
        
        # Navigate to startup URL
        startup_urls = profile_config.get('startup_urls', ["https://httpbin.org/ip"])
        if startup_urls:
            driver.get(startup_urls[0])
        
        print("Info: Profile launched successfully", file=sys.stderr)
        
        # Keep browser running
        try:
            while True:
                try:
                    driver.current_url
                    time.sleep(5)
                except Exception:
                    print("Info: Browser closed manually, exiting process", file=sys.stderr)
                    break
        except KeyboardInterrupt:
            try:
                driver.quit()
            except:
                pass
        
        # Save session data
        try:
            driver.execute_script("window.localStorage.setItem('profile_closed', Date.now());")
            time.sleep(2)
        except:
            pass
        
        driver.quit()
        print(f"Success: Browser for profile '{name}' closed. Session saved.", file=sys.stderr)
        
    except Exception as e:
        print(f"Error launching browser for profile '{name}': {e}", file=sys.stderr)
        sys.exit(1)

def delete_profile(name):
    """Deletes a profile's configuration and its data directory."""
    profiles = load_profiles()
    
    if name not in profiles:
        print(f"Error: Profile '{name}' not found.", file=sys.stderr)
        sys.exit(1)

    del profiles[name]
    save_profiles(profiles)
    
    profile_data_path = os.path.join(PROFILES_DIR, name)
    if os.path.exists(profile_data_path):
        try:
            shutil.rmtree(profile_data_path)
        except Exception as e:
            print(f"Warning: Could not delete folder for '{name}': {e}", file=sys.stderr)
        
    print(f"Success: Profile '{name}' and its data have been deleted.", file=sys.stderr)

def instagram_follow(target_username, profile_count):
    """Automates Instagram follows using multiple random profiles."""
    profiles = load_profiles()
    
    if not profiles:
        print("Error: No profiles available.", file=sys.stderr)
        sys.exit(1)
    
    profile_names = list(profiles.keys())
    
    if profile_count > len(profile_names):
        print(f"Warning: Only {len(profile_names)} profiles available. Using all of them.", file=sys.stderr)
        profile_count = len(profile_names)
    
    # Select random profiles
    selected_profiles = random.sample(profile_names, profile_count)
    
    print(f"Info: Starting Instagram automation for @{target_username}", file=sys.stderr)
    print(f"Info: Using {profile_count} profiles: {', '.join(selected_profiles)}", file=sys.stderr)
    
    successful = 0
    failed = 0
    
    for profile_name in selected_profiles:
        print(f"Info: Processing profile '{profile_name}'...", file=sys.stderr)
        
        try:
            profile_config = profiles[profile_name]
            profile_data_path = os.path.abspath(os.path.join(PROFILES_DIR, profile_name))
            
            chrome_options = Options()
            
            # Essential Docker options
            if IS_DOCKER:
                chrome_options.add_argument("--no-sandbox")
                chrome_options.add_argument("--disable-dev-shm-usage")
                chrome_options.add_argument("--disable-gpu")
            
            # Profile settings
            chrome_options.add_argument(f"--user-data-dir={profile_data_path}")
            chrome_options.add_argument(f"--profile-directory=Default")
            chrome_options.add_argument("--no-first-run")
            chrome_options.add_argument("--no-default-browser-check")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            
            # Set user agent
            user_agent = profile_config['user_agent']
            if user_agent:
                chrome_options.add_argument(f"--user-agent={user_agent}")
            
            # Configure proxy if exists
            proxy = profile_config.get("proxy", "").strip()
            if proxy:
                if not proxy.startswith(('http://', 'https://', 'socks4://', 'socks5://')):
                    proxy = f'http://{proxy}'
                parsed = urllib.parse.urlparse(proxy)
                if parsed.scheme.lower() in ['socks4', 'socks5']:
                    proxy_server = f'{parsed.scheme}://{parsed.hostname}:{parsed.port}'
                else:
                    proxy_server = f'{parsed.hostname}:{parsed.port}'
                chrome_options.add_argument(f'--proxy-server={proxy_server}')
                
                if parsed.username and parsed.password:
                    proxy_auth_extension = create_proxy_auth_extension(
                        parsed.hostname, parsed.port, parsed.username, parsed.password
                    )
                    chrome_options.add_argument(f'--load-extension={proxy_auth_extension}')
            
            # Launch browser
            driver = uc.Chrome(options=chrome_options, use_subprocess=False)
            width, height = profile_config['window_size']
            driver.set_window_size(width, height)
            
            # Navigate to Instagram
            instagram_url = f"https://www.instagram.com/{target_username}/"
            driver.get(instagram_url)
            time.sleep(5)  # Wait for page load
            
            # Check if already following or need to login
            page_source = driver.page_source.lower()
            
            if "log in" in page_source or "login" in page_source:
                print(f"Info: Profile '{profile_name}' needs manual login. Opening Instagram...", file=sys.stderr)
                print(f"Info: Please log in manually, then the automation will continue in 60 seconds.", file=sys.stderr)
                time.sleep(60)  # Give time for manual login
                driver.get(instagram_url)
                time.sleep(5)
            
            # Try to find and click follow button
            try:
                # Try different button selectors that Instagram uses
                follow_button_selectors = [
                    "//button[contains(text(), 'Follow')]",
                    "//button[contains(@class, 'follow')]",
                    "//button[@type='button' and contains(., 'Follow')]",
                    "//button[contains(@class, '_acan') and contains(@class, '_acap')]"
                ]
                
                clicked = False
                for selector in follow_button_selectors:
                    try:
                        follow_button = WebDriverWait(driver, 5).until(
                            EC.element_to_be_clickable((By.XPATH, selector))
                        )
                        follow_button.click()
                        clicked = True
                        print(f"Success: Profile '{profile_name}' followed @{target_username}", file=sys.stderr)
                        successful += 1
                        time.sleep(2)
                        break
                    except:
                        continue
                
                if not clicked:
                    print(f"Warning: Could not find follow button for profile '{profile_name}'. May already be following or needs manual action.", file=sys.stderr)
                    failed += 1
                    
            except Exception as e:
                print(f"Error: Failed to click follow button for profile '{profile_name}': {e}", file=sys.stderr)
                failed += 1
            
            # Close browser
            driver.quit()
            time.sleep(2)  # Brief pause between profiles
            
        except Exception as e:
            print(f"Error: Failed to process profile '{profile_name}': {e}", file=sys.stderr)
            failed += 1
            try:
                driver.quit()
            except:
                pass
    
    # Print summary
    print(f"\n=== Instagram Automation Summary ===", file=sys.stderr)
    print(f"Target: @{target_username}", file=sys.stderr)
    print(f"Profiles used: {profile_count}", file=sys.stderr)
    print(f"Successful: {successful}", file=sys.stderr)
    print(f"Failed: {failed}", file=sys.stderr)
    print(f"===================================\n", file=sys.stderr)
    
    # Update analytics
    analytics_file = os.path.join('data', 'analytics.json')
    try:
        if os.path.exists(analytics_file):
            with open(analytics_file, 'r') as f:
                analytics = json.load(f)
        else:
            analytics = {'instagramFollows': {'totalSuccessful': 0, 'history': []}}
        
        if 'instagramFollows' not in analytics:
            analytics['instagramFollows'] = {'totalSuccessful': 0, 'history': []}
        
        analytics['instagramFollows']['totalSuccessful'] += successful
        analytics['instagramFollows']['history'].append({
            'target': target_username,
            'attempted': profile_count,
            'successful': successful,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })
        
        # Keep only last 50 entries
        analytics['instagramFollows']['history'] = analytics['instagramFollows']['history'][-50:]
        
        os.makedirs('data', exist_ok=True)
        with open(analytics_file, 'w') as f:
            json.dump(analytics, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not update analytics: {e}", file=sys.stderr)

# Command-line interface
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Browser Profile Manager CLI")
    subparsers = parser.add_subparsers(dest="command", required=True, help="Available commands")

    # Command: list
    parser_list = subparsers.add_parser("list", help="List all available profiles in JSON format.")

    # Command: create
    parser_create = subparsers.add_parser("create", help="Create a new browser profile.")
    parser_create.add_argument("--name", required=True, help="The name of the profile.")
    parser_create.add_argument("--proxy", default="", help="Proxy settings (e.g., 'http://user:pass@host:port'). Optional.")
    parser_create.add_argument("--config", help="JSON configuration string for advanced profile settings.")

    # Command: launch
    parser_launch = subparsers.add_parser("launch", help="Launch a browser session for a specific profile.")
    parser_launch.add_argument("--name", required=True, help="The name of the profile to launch.")

    # Command: delete
    parser_delete = subparsers.add_parser("delete", help="Delete a profile and its data.")
    parser_delete.add_argument("--name", required=True, help="The name of the profile to delete.")

    # Command: instagram-follow
    parser_instagram = subparsers.add_parser("instagram-follow", help="Automate Instagram follows using multiple profiles.")
    parser_instagram.add_argument("--target", required=True, help="Target Instagram username to follow.")
    parser_instagram.add_argument("--count", type=int, default=1, help="Number of profiles to use for following.")

    args = parser.parse_args()

    if args.command == "list":
        list_profiles()
    elif args.command == "create":
        config = None
        if hasattr(args, 'config') and args.config:
            try:
                config = json.loads(args.config)
            except json.JSONDecodeError:
                print("Error: Invalid JSON configuration.", file=sys.stderr)
                sys.exit(1)
        if config is None:
            config = {"proxy": args.proxy}
        else:
            config["proxy"] = args.proxy
        create_profile(args.name, config)
    elif args.command == "launch":
        launch_profile(args.name)
    elif args.command == "delete":
        delete_profile(args.name)
    elif args.command == "instagram-follow":
        instagram_follow(args.target, args.count)