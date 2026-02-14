import requests
import urllib.parse
import sys

def test_proxy(proxy_url):
    """Test proxy connection and get IP address"""
    print(f"Testing proxy: {proxy_url}")
    
    try:
        # Parse proxy URL
        if not proxy_url.startswith(('http://', 'https://', 'socks4://', 'socks5://')):
            proxy_url = f'http://{proxy_url}'
        
        parsed = urllib.parse.urlparse(proxy_url)
        print(f"Parsed - Host: {parsed.hostname}, Port: {parsed.port}, User: {parsed.username}")
        
        # Test with requests
        proxies = {
            'http': proxy_url,
            'https': proxy_url
        }
        
        print("Testing proxy connection...")
        response = requests.get('http://httpbin.org/ip', proxies=proxies, timeout=10)
        
        if response.status_code == 200:
            ip_data = response.json()
            print(f"SUCCESS: Proxy working! IP: {ip_data['origin']}")
            return True
        else:
            print(f"FAILED: Proxy failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"FAILED: Proxy test failed: {e}")
        return False

def test_no_proxy():
    """Test direct connection without proxy"""
    print("Testing direct connection (no proxy)...")
    
    try:
        response = requests.get('http://httpbin.org/ip', timeout=10)
        if response.status_code == 200:
            ip_data = response.json()
            print(f"SUCCESS: Direct connection working! IP: {ip_data['origin']}")
            return True
        else:
            print(f"FAILED: Direct connection failed with status: {response.status_code}")
            return False
    except Exception as e:
        print(f"FAILED: Direct connection failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Proxy Test Tool ===\n")
    
    # Test direct connection first
    test_no_proxy()
    print()
    
    # Test proxy if provided
    if len(sys.argv) > 1:
        proxy = sys.argv[1]
        test_proxy(proxy)
    else:
        print("Usage: python test_proxy.py <proxy_url>")
        print("Example: python test_proxy.py http://user:pass@proxy.com:8080")
        print("Example: python test_proxy.py proxy.com:8080")