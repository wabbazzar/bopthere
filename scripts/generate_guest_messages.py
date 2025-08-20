#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class User:
    username: str
    password: str
    full_name: str
    phone: str

    @property
    def display_name(self) -> str:
        if self.full_name and self.full_name.strip():
            return self.full_name.strip()
        # Fallback to a prettified username
        return self.username.replace(".", " ").strip().title()

    @property
    def first_name(self) -> str:
        if self.full_name and self.full_name.strip():
            return self.full_name.strip().split()[0]
        # Fallback from username
        return self.username.split(".")[0]

    @property
    def last_name(self) -> str:
        if self.full_name and self.full_name.strip():
            tokens = self.full_name.strip().split()
            if len(tokens) > 1:
                return tokens[-1]
        # Fallback from username if present
        parts = self.username.split(".")
        return parts[1] if len(parts) > 1 else ""


def load_users(users_path: Path) -> List[User]:
    data = json.loads(users_path.read_text(encoding="utf-8"))
    users: List[User] = []
    for row in data:
        users.append(
            User(
                username=row.get("username", "").strip(),
                password=row.get("password", "").strip(),
                full_name=row.get("full_name", "").strip(),
                phone=row.get("phone", "").strip(),
            )
        )
    return users


def normalize(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def names_in_password(u: User, v: User) -> bool:
    pw = normalize(u.password)
    v_first = normalize(v.first_name)
    v_last = normalize(v.last_name)
    # Consider either first or last name mentioned
    return bool(v_first and v_first in pw) or bool(v_last and v_last in pw)


def likely_partners(u1: User, u2: User) -> bool:
    # Strong signal: each other's names appear in passwords
    if names_in_password(u1, u2) and names_in_password(u2, u1):
        return True

    # Medium signal: at least one direction appears in password and they are adjacent last names or share last name
    share_last_name = bool(u1.last_name and u1.last_name == u2.last_name)
    if share_last_name and (names_in_password(u1, u2) or names_in_password(u2, u1)):
        return True

    # Weak signal: share last name and both have two+ name tokens
    if share_last_name and (bool(u1.full_name.strip()) or bool(u2.full_name.strip())):
        return True

    return False


def build_partner_index(users: List[User]) -> Dict[str, str]:
    partner_of: Dict[str, str] = {}
    # First pass: scan adjacent entries (most lists appear paired)
    for i in range(len(users) - 1):
        a, b = users[i], users[i + 1]
        if likely_partners(a, b):
            partner_of[a.username] = b.username
            partner_of[b.username] = a.username

    # Second pass: global match for anyone not already paired
    for i, a in enumerate(users):
        if a.username in partner_of:
            continue
        for j, b in enumerate(users):
            if i == j or b.username in partner_of:
                continue
            if likely_partners(a, b):
                partner_of[a.username] = b.username
                partner_of[b.username] = a.username
                break

    return partner_of


def choose_primary_recipient(group: List[User]) -> Optional[User]:
    # Prefer member with a phone number
    for member in group:
        if member.phone:
            return member
    return None


def fill_template(
    template_text: str,
    primary: User,
    partner: Optional[User],
) -> str:
    filled = template_text

    replacements = {
        "{guest}": primary.display_name,
        "{guest_username}": primary.username,
        # Note: the template intentionally misspells this placeholder; preserve it
        "{guest_passwrod}": primary.password,
    }

    if partner is not None:
        replacements.update(
            {
                "{guest2_username}": partner.username,
                "{guest2_password}": partner.password,
            }
        )
    else:
        # Remove partner lines if no partner
        lines = []
        for line in filled.splitlines():
            if ("{guest2_username}" in line) or ("{guest2_password}" in line):
                continue
            lines.append(line)
        filled = "\n".join(lines)

    for needle, value in replacements.items():
        filled = filled.replace(needle, value)

    return filled


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    template_path = repo_root / "docs" / "message_to_guests.md"
    users_path = repo_root / "local" / "users.json"
    output_dir = repo_root / "docs" / "messages"

    output_dir.mkdir(parents=True, exist_ok=True)

    template_text = template_path.read_text(encoding="utf-8")
    users = load_users(users_path)

    # Build quick username -> User index
    by_username: Dict[str, User] = {u.username: u for u in users}
    partner_index = build_partner_index(users)

    visited: set[str] = set()
    groups: List[List[User]] = []

    # Build groups (couples or singles) with mutual pair confirmation when possible
    for u in users:
        if u.username in visited:
            continue
        partner_username = partner_index.get(u.username)
        if partner_username:
            v = by_username.get(partner_username)
            if v and partner_index.get(v.username) == u.username:
                groups.append([u, v])
                visited.add(u.username)
                visited.add(v.username)
                continue
        groups.append([u])
        visited.add(u.username)

    # For each group, emit a single message for the member who has a phone
    for group in groups:
        primary = choose_primary_recipient(group)
        if primary is None:
            # Skip groups with no reachable phone number
            continue

        partner: Optional[User] = None
        if len(group) == 2:
            partner = group[0] if group[1].username == primary.username else group[1]

        message_text = fill_template(template_text, primary, partner)

        # File name: primary username
        outfile = output_dir / f"{primary.username}.md"
        outfile.write_text(message_text, encoding="utf-8")

    print(f"Generated messages in: {output_dir}")


if __name__ == "__main__":
    main()

