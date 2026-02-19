import os
import json
import argparse
import sys
import time
import undetected_chromedriver as uc
from selenium import webdriver as regular_webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.proxy import Proxy, ProxyType
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import shutil
import random
import urllib.parse

# --- CONFIGURATION ---
# Use environment variable for Docker compatibility
CHROMEDRIVER_PATH = os.environ.get('chromedriver.exe', 'chromedriver')
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
    
    # Metadata
    profiles[name]["created_at"] = time.strftime('%Y-%m-%d %H:%M:%S')
    profiles[name]["status"] = "active"
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
    
    # Get the debugging port (passed from server.js via env var)
    debug_port = os.environ.get('CHROME_DEBUG_PORT', '0')
    
    # Essential Docker options
    if IS_DOCKER:
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        if debug_port and debug_port != '0':
            chrome_options.add_argument(f"--remote-debugging-port={debug_port}")
            chrome_options.add_argument("--remote-debugging-address=0.0.0.0")
        print(f"Info: Docker mode — headless with debug port {debug_port}", file=sys.stderr)
    
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
        print(f"Info: Profile data directory: {profile_data_path}", file=sys.stderr)
        
        if IS_DOCKER:
            # In Docker use regular selenium — undetected_chromedriver patching fails on Alpine musl
            chromium_paths = ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome']
            for cp in chromium_paths:
                if os.path.exists(cp):
                    chrome_options.binary_location = cp
                    print(f"Info: Using Chrome binary: {cp}", file=sys.stderr)
                    break
            chromedriver_path = os.environ.get('CHROMEDRIVER_PATH', '/usr/bin/chromedriver')
            service = ChromeService(executable_path=chromedriver_path)
            driver = regular_webdriver.Chrome(service=service, options=chrome_options)
            print(f"Info: Chrome (headless) started via regular selenium", file=sys.stderr)
        else:
            # On localhost use undetected_chromedriver for anti-detection
            print(f"Info: Using undetected_chromedriver (auto-download if needed)", file=sys.stderr)
            driver = uc.Chrome(options=chrome_options, use_subprocess=False)
        
        print(f"Info: Chrome driver initialized successfully", file=sys.stderr)
        
        # Set window size
        width, height = profile_config['window_size']
        driver.set_window_size(width, height)
        print(f"Info: Set window size to {width}x{height}", file=sys.stderr)
        
        # Navigate to startup URL
        startup_urls = profile_config.get('startup_urls', ["https://httpbin.org/ip"])
        if startup_urls:
            driver.get(startup_urls[0])
            # remember the startup tab/window so we can detect if the user closed it
            try:
                startup_handle = driver.current_window_handle
            except Exception:
                startup_handle = None

        # Check for Instagram ban indicators if startup landed on Instagram
        # Wait a bit for page to load before checking
        time.sleep(3)
        try:
            current_url = driver.current_url or ''
            page_src = (driver.page_source or '').lower()
            check_instagram = any('instagram.com' in u for u in startup_urls) or 'instagram.com' in current_url
            if check_instagram:
                ban_indicators = [
                    "account has been disabled",
                    "this page isn't available",
                    "page not found",
                    "sorry, this page isn't available",
                    "sorry, this page isn't available.",
                    "account blocked",
                    "your account has been disabled",
                    "we restrict access to your account",
                    "action blocked",
                    "suspended",
                    "we suspended your account",
                    "temporarily blocked",
                    "help us confirm you own this account",
                    "confirm your identity"
                ]
                if any(ind in page_src for ind in ban_indicators):
                    print(f"Warning: Detected possible banned/restricted Instagram for profile '{name}'. Marking as banned.", file=sys.stderr)
                    profiles[name]['status'] = 'banned'
                    save_profiles(profiles)
                    try:
                        driver.quit()
                    except:
                        pass
                    sys.exit(0)
        except Exception as e:
            print(f"Warning: Error during ban detection: {e}", file=sys.stderr)

        print("Info: Profile launched successfully", file=sys.stderr)
        
        # Keep browser running until the server kills this process (via Close button)
        # Only exit if Chrome becomes completely unresponsive for a sustained period
        instagram_seen = False
        consecutive_errors = 0
        MAX_ERRORS = 12  # 12 * 5s = 60s of unresponsiveness before giving up

        try:
            while True:
                try:
                    # Just check the driver is still alive
                    _ = driver.window_handles
                    consecutive_errors = 0  # reset on success
                    # Track Instagram visits for analytics only (no auto-ban)
                    try:
                        cur = driver.current_url or ''
                        if 'instagram.com' in cur.lower():
                            instagram_seen = True
                    except:
                        pass
                    time.sleep(5)
                except Exception:
                    consecutive_errors += 1
                    if consecutive_errors >= MAX_ERRORS:
                        print(f"Info: Browser appears closed or unresponsive after {MAX_ERRORS * 5}s, exiting.", file=sys.stderr)
                        break
                    time.sleep(5)
        except KeyboardInterrupt:
            pass

        # Clean exit — do NOT auto-ban, do NOT call driver.quit() (server kills via SIGKILL)
        try:
            driver.quit()
        except:
            pass

        print(f"Success: Browser session for profile '{name}' ended.", file=sys.stderr)
        
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
    
    # Filter out banned profiles - only use active accounts
    active_profiles = {name: config for name, config in profiles.items() 
                       if config.get('status') != 'banned'}
    
    if not active_profiles:
        print("Error: No active profiles available. All profiles are banned.", file=sys.stderr)
        sys.exit(1)
    
    profile_names = list(active_profiles.keys())
    
    if profile_count > len(profile_names):
        print(f"Warning: Only {len(profile_names)} active profiles available. Using all of them.", file=sys.stderr)
        profile_count = len(profile_names)
    
    # Select random profiles from active ones only
    selected_profiles = random.sample(profile_names, profile_count)
    
    print(f"Info: Starting Instagram automation for @{target_username}", file=sys.stderr)
    print(f"Info: Using {profile_count} profiles: {', '.join(selected_profiles)}", file=sys.stderr)
    
    successful = 0
    failed = 0
    
    for profile_name in selected_profiles:
        print(f"Info: Processing profile '{profile_name}'...", file=sys.stderr)
        
        try:
            profile_config = active_profiles[profile_name]
            profile_data_path = os.path.abspath(os.path.join(PROFILES_DIR, profile_name))
            
            chrome_options = Options()
            
            # Headless mode for faster execution
            chrome_options.add_argument("--headless=new")
            
            # Essential Docker options
            if IS_DOCKER:
                chrome_options.add_argument("--no-sandbox")
                chrome_options.add_argument("--disable-dev-shm-usage")
                chrome_options.add_argument("--disable-gpu")
            
            # Performance optimizations for speed
            chrome_options.add_argument("--disable-images")
            chrome_options.add_argument("--blink-settings=imagesEnabled=false")
            chrome_options.add_argument("--disable-software-rasterizer")
            chrome_options.add_argument("--disable-dev-tools")
            chrome_options.page_load_strategy = 'eager'  # Don't wait for all resources
            
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
            has_proxy_extension = False
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
                    has_proxy_extension = True
            
            # Disable extensions only if we don't need proxy auth extension
            if not has_proxy_extension:
                chrome_options.add_argument("--disable-extensions")
            
            # Launch browser
            driver = uc.Chrome(options=chrome_options, use_subprocess=False)
            width, height = profile_config['window_size']
            driver.set_window_size(width, height)
            
            # Navigate to Instagram
            instagram_url = f"https://www.instagram.com/{target_username}/"
            driver.get(instagram_url)
            time.sleep(1)  # Minimal wait for page load

            # Early check for ban indicators
            page_source = (driver.page_source or '').lower()
            ban_indicators = [
                "account has been disabled",
                "this page isn't available",
                "page not found",
                "sorry, this page isn't available",
                "account blocked",
                "your account has been disabled",
                "we restrict access to your account",
                "action blocked"
            ]
            if any(ind in page_source for ind in ban_indicators):
                print(f"Warning: Detected possible banned Instagram for profile '{profile_name}'. Marking as banned.", file=sys.stderr)
                profiles[profile_name]['status'] = 'banned'
                save_profiles(profiles)
                try:
                    driver.quit()
                except:
                    pass
                failed += 1
                continue

            # Check if already following or need to login
            page_source = driver.page_source.lower()
            
            if "log in" in page_source or "login" in page_source:
                print(f"Info: Profile '{profile_name}' needs manual login. Opening Instagram...", file=sys.stderr)
                print(f"Info: Please log in manually, then the automation will continue in 60 seconds.", file=sys.stderr)
                time.sleep(60)  # Give time for manual login
                driver.get(instagram_url)
                time.sleep(1)  # Minimal wait after login
            
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
                        follow_button = WebDriverWait(driver, 3).until(
                            EC.element_to_be_clickable((By.XPATH, selector))
                        )
                        follow_button.click()
                        clicked = True
                        print(f"Success: Profile '{profile_name}' followed @{target_username}", file=sys.stderr)
                        successful += 1
                        # Update analytics incrementally so the UI can poll and show live updates
                        try:
                            analytics_file = os.path.join('data', 'analytics.json')
                            if os.path.exists(analytics_file):
                                with open(analytics_file, 'r') as af:
                                    analytics = json.load(af)
                            else:
                                analytics = {'instagramFollows': {'totalSuccessful': 0, 'history': []}}

                            if 'instagramFollows' not in analytics:
                                analytics['instagramFollows'] = {'totalSuccessful': 0, 'history': []}

                            analytics['instagramFollows']['totalSuccessful'] = analytics['instagramFollows'].get('totalSuccessful', 0) + 1
                            analytics['instagramFollows']['history'].append({
                                'target': target_username,
                                'attempted': 1,
                                'successful': 1,
                                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
                            })
                            # Keep only last 50 entries
                            analytics['instagramFollows']['history'] = analytics['instagramFollows']['history'][-50:]
                            os.makedirs('data', exist_ok=True)
                            with open(analytics_file, 'w') as af:
                                json.dump(analytics, af, indent=2)
                        except Exception:
                            pass
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
    parser_launch.add_argument("--debug-port", type=int, default=0, help="Chrome remote debugging port.")

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
        if hasattr(args, 'debug_port') and args.debug_port:
            os.environ['CHROME_DEBUG_PORT'] = str(args.debug_port)
        launch_profile(args.name)
    elif args.command == "delete":
        delete_profile(args.name)
    elif args.command == "instagram-follow":
        instagram_follow(args.target, args.count)