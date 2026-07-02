import urllib.request
import json
import ipaddress

def find_region():
    ipv6 = "2600:1f18:16e0:2800:7e73:ac72:763d:43c6"
    print("Database IPv6 address:", ipv6)

    # Download AWS IP ranges
    print("Downloading AWS IP ranges...")
    with urllib.request.urlopen("https://ip-ranges.amazonaws.com/ip-ranges.json") as url:
        data = json.loads(url.read().decode())

    db_ip = ipaddress.ip_address(ipv6)

    # Search for IPv6 prefix
    for prefix in data.get("ipv6_prefixes", []):
        net = ipaddress.ip_network(prefix["ipv6_prefix"])
        if db_ip in net:
            print(f"Match found: {prefix['ipv6_prefix']} in region: {prefix['region']}")
            return

    print("No matching AWS IPv6 range found.")

if __name__ == "__main__":
    find_region()
