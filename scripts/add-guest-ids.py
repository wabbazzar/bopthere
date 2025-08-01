#!/usr/bin/env python3
"""
Add unique IDs to guest list JSON
Adds unique identifiers to each guest in the guest_list.json file
"""

import json
import re
from pathlib import Path

def generate_id(name, occupation):
    """Generate a unique ID from name and occupation"""
    # Convert to lowercase and replace spaces/special chars with dashes
    clean_name = re.sub(r'[^\w\s]', '', name.lower())
    clean_name = re.sub(r'\s+', '-', clean_name.strip())
    
    clean_occupation = re.sub(r'[^\w\s]', '', occupation.lower())
    clean_occupation = re.sub(r'\s+', '-', clean_occupation.strip())
    
    return f"{clean_name}-{clean_occupation}"

def main():
    # Read the guest list
    guest_file = Path('data/guest_list.json')
    
    if not guest_file.exists():
        print(f"Error: {guest_file} not found")
        return
    
    with open(guest_file, 'r') as f:
        data = json.load(f)
    
    # Add IDs to guests that don't have them
    used_ids = set()
    updated_count = 0
    
    for i, guest in enumerate(data['guests']):
        if 'id' not in guest:
            base_id = generate_id(guest['name'], guest['occupation'])
            
            # Ensure uniqueness
            guest_id = base_id
            counter = 1
            while guest_id in used_ids:
                guest_id = f"{base_id}-{counter}"
                counter += 1
            
            guest['id'] = guest_id
            used_ids.add(guest_id)
            updated_count += 1
            print(f"Added ID '{guest_id}' to {guest['name']} ({guest['occupation']})")
        else:
            used_ids.add(guest['id'])
    
    # Write back the updated data
    with open(guest_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\nUpdated {updated_count} guests with unique IDs")
    print(f"Total guests: {len(data['guests'])}")

if __name__ == "__main__":
    main()