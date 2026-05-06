"""Daily deal finder — search per-user, score, send best deal via Signal."""

import json
import logging
import subprocess
import sys
from pathlib import Path

from .db import get_db, get_enabled_alerts, save_sent_deal
from .scorer import rank_deals
from .search import search_all_destinations

log = logging.getLogger("travel-bop")

NOTIFY_SCRIPT = Path.home() / "code" / "wabbazzar-ice" / "scripts" / "notify.sh"


def notify(title: str, body: str, recipient: str | None = None):
    """Send a Signal notification via wabbazzar-ice notify.sh."""
    if NOTIFY_SCRIPT.exists():
        cmd = [str(NOTIFY_SCRIPT), title, body]
        if recipient:
            cmd.extend(["--recipient", recipient])
        subprocess.run(cmd, capture_output=True)
    else:
        log.warning("notify.sh not found at %s", NOTIFY_SCRIPT)
        print(f"[NOTIFY] {title}\n{body}")


def _deal_to_json(deal) -> str:
    return json.dumps({
        "destination_city": deal.destination_city,
        "destination_country": deal.destination_country,
        "total_cost": deal.total_cost,
        "score": deal.score,
        "source": deal.source,
        "booking_url": deal.outbound.booking_url,
    })


def find_and_send_for_user(origin: str, signal_number: str, username: str):
    """Search deals for a specific user's home airport and send via Signal."""
    log.info("Searching for %s (origin: %s)...", username, origin)

    try:
        gf_deals = search_all_destinations(origin=origin)
        log.info("Google Flights: %d deals for %s", len(gf_deals), username)
    except Exception as e:
        log.warning("Google Flights search failed for %s: %s", username, e)
        return

    if not gf_deals:
        log.info("No deals for %s today", username)
        return

    conn = get_db()
    ranked = rank_deals(gf_deals, conn)

    if not ranked:
        log.info("No deals within budget for %s", username)
        return

    best = ranked[0]
    log.info("Best for %s: %s — $%.0f (score: %.0f)", username, best.destination_city, best.total_cost, best.score)

    summary = best.summary()
    deal_id = save_sent_deal(
        conn,
        destination=best.destination_city,
        country=best.destination_country,
        depart_date=best.outbound.depart.date().isoformat(),
        total_cost=best.total_cost,
        summary=summary,
        deal_json=_deal_to_json(best),
    )

    header = f"🌍 Daily Travel Deal #{deal_id}"
    footer = "\n💭 Reply: like / dislike / or tell me what you think"
    msg = f"{header}\n\n{summary}{footer}"

    notify("travel-bop", msg, recipient=signal_number if signal_number else None)
    log.info("Deal #%d sent to %s", deal_id, username)


def find_and_send_all():
    """Main entry: iterate all users with alerts enabled, search per-user."""
    conn = get_db()
    alerts = get_enabled_alerts(conn)

    if not alerts:
        log.info("No users have deal alerts enabled, skipping")
        return

    log.info("Running deal search for %d user(s)", len(alerts))
    for alert in alerts:
        find_and_send_for_user(
            origin=alert["home_airport"],
            signal_number=alert["signal_number"],
            username=alert["username"],
        )


# Backward compat: keep find_and_send for CLI manual trigger
def find_and_send():
    """Legacy single-user search (AUS, default Signal)."""
    find_and_send_for_user(origin="AUS", signal_number="", username="manual")


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    find_and_send_all()


if __name__ == "__main__":
    main()
