"""CLI for travel-bop — called by ice-agent for feedback and manual triggers.

Usage:
    python -m travel_bop.cli feedback <reaction> [note]
    python -m travel_bop.cli feedback <deal_id> <reaction> [note]
    python -m travel_bop.cli search
    python -m travel_bop.cli latest
    python -m travel_bop.cli prefs set <key> <value>
"""

import sys

from .db import get_db, save_feedback, get_latest_deal, set_preference


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m travel_bop.cli <command> [args]")
        print("Commands: feedback, search, latest, prefs")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "feedback":
        if len(sys.argv) < 4:
            if len(sys.argv) == 3:
                reaction = sys.argv[2]
                conn = get_db()
                latest = get_latest_deal(conn)
                if not latest:
                    print("No deals sent yet")
                    sys.exit(1)
                deal_id = latest["id"]
                save_feedback(conn, deal_id, reaction)
                print(f"Saved '{reaction}' for deal #{deal_id} ({latest['destination']})")
            else:
                print("Usage: feedback <reaction> [note]")
                print("       feedback <deal_id> <reaction> [note]")
                sys.exit(1)
        else:
            try:
                deal_id = int(sys.argv[2])
                reaction = sys.argv[3]
                note = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else ""
            except ValueError:
                reaction = sys.argv[2]
                note = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else ""
                conn = get_db()
                latest = get_latest_deal(conn)
                if not latest:
                    print("No deals sent yet")
                    sys.exit(1)
                deal_id = latest["id"]

            conn = get_db()
            save_feedback(conn, deal_id, reaction, note)
            print(f"Saved '{reaction}' for deal #{deal_id}")

    elif cmd == "search":
        from .daily_deal import find_and_send
        import logging
        logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
        find_and_send()

    elif cmd == "latest":
        conn = get_db()
        latest = get_latest_deal(conn)
        if latest:
            print(latest["summary"])
        else:
            print("No deals sent yet")

    elif cmd == "prefs":
        if len(sys.argv) < 3:
            print("Usage: prefs set <key> <value>")
            sys.exit(1)
        subcmd = sys.argv[2]
        if subcmd == "set" and len(sys.argv) >= 5:
            conn = get_db()
            key = sys.argv[3]
            value = " ".join(sys.argv[4:])
            set_preference(conn, key, value)
            print(f"Set {key} = {value}")
        else:
            print("Usage: prefs set <key> <value>")

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
