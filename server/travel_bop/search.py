"""Multi-source flight deal search.

Strategy: search ALL destinations but only keep flights Google Flights
marks as "low" price (cheaper than usual). RSS feeds supplement with
curated human-found deals and error fares.

Sources:
1. fast-flights (Google Flights scraping, free, no API key)
   — uses current_price field to filter for actual deals
2. Secret Flying RSS (curated deals, error fares)
3. The Flight Deal RSS (structured deal posts)
4. Frequent Miler RSS (Chase transfer bonus alerts)
"""

import logging
import re
import time
from datetime import date, datetime, timedelta

import feedparser
from fast_flights import FlightData, Passengers, get_flights

from .db import get_db, get_preference
from .models import Deal, Flight

log = logging.getLogger("travel-bop")

# Destinations within ~4 hour flight from AUS — practical for Thu-Sun weekend trips
# Rough flight times from Austin:
#   <2hr: Dallas, Houston, New Orleans, San Antonio, Oklahoma City
#   2-3hr: Denver, Chicago, Nashville, Atlanta, Miami, most of Mexico
#   3-4hr: NYC, Boston, Seattle, Portland, SFO, all of Mexico, Caribbean, Guatemala, Costa Rica
#   >4hr: Europe, Asia, South America (excluded for 3-day trips)
DESTINATIONS = [
    # Domestic — under 4 hours from AUS
    ("Denver", "DEN", "United States"),
    ("New Orleans", "MSY", "United States"),
    ("Chicago", "ORD", "United States"),
    ("New York", "JFK", "United States"),
    ("Nashville", "BNA", "United States"),
    ("Asheville", "AVL", "United States"),
    ("Santa Fe", "SAF", "United States"),
    ("Savannah", "SAV", "United States"),
    ("Albuquerque", "ABQ", "United States"),
    ("Salt Lake City", "SLC", "United States"),
    ("Minneapolis", "MSP", "United States"),
    ("Washington DC", "DCA", "United States"),
    ("Boston", "BOS", "United States"),
    ("Philadelphia", "PHL", "United States"),
    ("Atlanta", "ATL", "United States"),
    ("Miami", "MIA", "United States"),
    ("San Francisco", "SFO", "United States"),
    ("Portland", "PDX", "United States"),
    ("Seattle", "SEA", "United States"),
    ("Bozeman", "BZN", "United States"),
    ("Jackson Hole", "JAC", "United States"),
    ("Sedona", "FLG", "United States"),
    # Mexico — all under 4 hours from AUS
    ("Mexico City", "MEX", "Mexico"),
    ("Oaxaca", "OAX", "Mexico"),
    ("Mérida", "MID", "Mexico"),
    ("Guanajuato", "BJX", "Mexico"),
    ("Guadalajara", "GDL", "Mexico"),
    ("San José del Cabo", "SJD", "Mexico"),
    ("Puerto Vallarta", "PVR", "Mexico"),
    # Central America / Caribbean — borderline but doable
    ("Guatemala City", "GUA", "Guatemala"),
    ("San José", "SJO", "Costa Rica"),
    ("San Juan", "SJU", "Puerto Rico"),
    ("Havana", "HAV", "Cuba"),
    # Colombia — ~4.5hr but direct flights exist
    ("Bogotá", "BOG", "Colombia"),
    ("Medellín", "MDE", "Colombia"),
    ("Cartagena", "CTG", "Colombia"),
]

# RSS feeds
DEAL_FEEDS = [
    ("Secret Flying", "https://www.secretflying.com/feed/"),
    ("The Flight Deal", "https://www.theflightdeal.com/feed/"),
]

POINTS_FEEDS = [
    ("Frequent Miler", "https://frequentmiler.com/feed/"),
]


# ---------------------------------------------------------------------------
# Google Flights via fast-flights — only keep "low" price deals
# ---------------------------------------------------------------------------


def _get_blocked_ranges() -> list[tuple[date, date]]:
    """Load blocked date ranges from preferences (format: 'start:end,start:end')."""
    conn = get_db()
    raw = get_preference(conn, "blocked_dates")
    if not raw:
        return []
    ranges = []
    for chunk in raw.split(","):
        parts = chunk.strip().split(":")
        if len(parts) == 2:
            try:
                ranges.append((date.fromisoformat(parts[0]), date.fromisoformat(parts[1])))
            except ValueError:
                pass
    return ranges


def _overlaps_blocked(depart: date, return_date: date, blocked: list[tuple[date, date]]) -> bool:
    """Check if a trip window overlaps any blocked range."""
    return any(depart <= end and return_date >= start for start, end in blocked)


def find_thursday_weekends(
    from_date: date | None = None,
    weeks_ahead: int = 12,
) -> list[tuple[date, date]]:
    """Generate (depart_thu, return_sun) pairs for upcoming weekends, skipping blocked dates."""
    if from_date is None:
        from_date = date.today()

    days_until_thu = (3 - from_date.weekday()) % 7
    if days_until_thu == 0:
        days_until_thu = 7
    next_thu = from_date + timedelta(days=days_until_thu)

    blocked = _get_blocked_ranges()
    pairs = []
    for i in range(weeks_ahead):
        thu = next_thu + timedelta(weeks=i)
        sun = thu + timedelta(days=3)
        if sun <= date(2026, 11, 1) and not _overlaps_blocked(thu, sun, blocked):
            pairs.append((thu, sun))
    return pairs


def _get_united_price(result) -> float | None:
    """Extract the cheapest United price from a search result."""
    for flight in result.flights[:5]:
        if flight.name and "United" in flight.name:
            price_text = flight.price or ""
            m = re.search(r"[\$€£]?([\d,]+)", price_text)
            if m:
                return float(m.group(1).replace(",", ""))
    return None


def search_google_flights(
    origin: str,
    dest_code: str,
    dest_city: str,
    dest_country: str,
    depart: date,
    return_date: date,
    typical_price: float = 0.0,
) -> list[Deal]:
    """Search Google Flights for a specific route. Only returns deals marked 'low' price."""
    deals = []
    try:
        result = get_flights(
            flight_data=[
                FlightData(date=depart.strftime("%Y-%m-%d"), from_airport=origin, to_airport=dest_code),
                FlightData(date=return_date.strftime("%Y-%m-%d"), from_airport=dest_code, to_airport=origin),
            ],
            trip="round-trip",
            passengers=Passengers(adults=2),
            seat="economy",
            max_stops=1,
        )

        price_level = result.current_price  # 'low', 'typical', 'high'
        if price_level != "low":
            return []

        for flight in result.flights[:3]:  # top 3 when price is low
            try:
                price_text = flight.price or ""
                price_match = re.search(r"[\$€£]?([\d,]+)", price_text)
                if not price_match:
                    continue
                price_total = float(price_match.group(1).replace(",", ""))

                carrier = flight.name or "?"

                # United flights only (Chase Sapphire transfer partner)
                if "United" not in carrier:
                    continue

                stops = flight.stops if isinstance(flight.stops, int) else 0

                # price_total is already for all passengers
                food_per_day = _estimate_food_budget(dest_country)
                nights = (return_date - depart).days
                hotel_est = _estimate_hotel_cost(dest_country, nights)
                food_est = food_per_day * nights * 2
                total = price_total + hotel_est + food_est

                if total > 3200:
                    continue

                # Parse duration string like "2 hr 30 min"
                dur_hours = 0.0
                dur_str = flight.duration or ""
                hr_m = re.search(r"(\d+)\s*hr", dur_str)
                min_m = re.search(r"(\d+)\s*min", dur_str)
                if hr_m:
                    dur_hours += float(hr_m.group(1))
                if min_m:
                    dur_hours += float(min_m.group(1)) / 60

                search_url = (
                    f"https://www.google.com/travel/flights?q=Flights+to+{dest_code}"
                    f"+from+{origin}+on+{depart}+through+{return_date}"
                )

                # Parse actual departure/arrival from flight data
                # Format: "11:01 AM on Thu, Apr 16"
                dep_str = flight.departure or ""
                arr_str = flight.arrival or ""
                departure_dt = _parse_flight_time(dep_str, depart)
                arrival_dt = _parse_flight_time(arr_str, depart)
                return_dep_dt = datetime.combine(return_date, datetime.min.time().replace(hour=12))
                return_arr_dt = datetime.combine(return_date, datetime.min.time().replace(hour=12))

                # Store full round-trip price on outbound, 0 on inbound
                # (fast-flights gives one price for the whole trip)
                outbound = Flight(
                    origin=origin, destination=dest_code,
                    depart=departure_dt, arrive=arrival_dt,
                    carrier=carrier, stops=stops,
                    price_usd=price_total,
                    booking_url=search_url,
                    duration_hours=dur_hours,
                )
                inbound = Flight(
                    origin=dest_code, destination=origin,
                    depart=return_dep_dt, arrive=return_arr_dt,
                    carrier=carrier, stops=stops,
                    price_usd=0,
                    booking_url=search_url,
                    duration_hours=dur_hours,
                )

                deal = Deal(
                    destination_city=dest_city,
                    destination_country=dest_country,
                    outbound=outbound, inbound=inbound,
                    hotel=None,
                    food_budget_per_day=food_per_day,
                    total_cost=total,
                    highlights=["cheaper than usual"],
                    source="google_flights",
                )
                deals.append(deal)

            except Exception as e:
                log.debug("Failed to parse flight: %s", e)

    except Exception as e:
        log.debug("GF %s→%s: %s", origin, dest_code, type(e).__name__)

    return deals


def search_all_destinations(origin: str = "AUS") -> list[Deal]:
    """Search ALL destinations on the next few weekends. Only keeps 'low' price results.
    For routes with deals, finds the typical price for comparison."""
    weekends = find_thursday_weekends(weeks_ahead=8)
    all_deals = []
    searched = 0
    # Track which routes had low deals so we can find typical prices
    routes_with_deals: dict[str, list[Deal]] = {}

    for dest_city, dest_code, dest_country in DESTINATIONS:
        for depart, return_date in weekends[:3]:
            deals = search_google_flights(
                origin=origin,
                dest_code=dest_code,
                dest_city=dest_city,
                dest_country=dest_country,
                depart=depart,
                return_date=return_date,
            )
            searched += 1
            if deals:
                all_deals.extend(deals)
                routes_with_deals[dest_code] = deals
            time.sleep(0.5)

    # Second pass: for routes with deals, find the typical United price
    # by checking a weekend that wasn't "low"
    for dest_code, deals in routes_with_deals.items():
        typical = _find_typical_price(origin, dest_code, weekends)
        if typical:
            for d in deals:
                d.typical_flight_price = typical

    log.info("Searched %d routes, found %d 'low' price deals", searched, len(all_deals))
    return all_deals


def _find_typical_price(origin: str, dest_code: str, weekends: list[tuple[date, date]]) -> float | None:
    """Search later weekends to find a typical United price for comparison."""
    for depart, return_date in weekends[4:7]:  # check further-out weekends
        try:
            result = get_flights(
                flight_data=[
                    FlightData(date=depart.strftime("%Y-%m-%d"), from_airport=origin, to_airport=dest_code),
                    FlightData(date=return_date.strftime("%Y-%m-%d"), from_airport=dest_code, to_airport=origin),
                ],
                trip="round-trip",
                passengers=Passengers(adults=2),
                seat="economy",
                max_stops=1,
            )
            if result.current_price in ("typical", "high"):
                price = _get_united_price(result)
                if price:
                    return price
        except Exception:
            pass
        time.sleep(0.5)
    return None


# ---------------------------------------------------------------------------
# RSS deal feeds
# ---------------------------------------------------------------------------


def fetch_rss_deals(origin: str = "AUS") -> list[Deal]:
    """Fetch curated deals from RSS feeds."""
    deals = []
    for feed_name, feed_url in DEAL_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:20]:
                deal = _parse_rss_deal(entry, feed_name, origin)
                if deal:
                    deals.append(deal)
        except Exception as e:
            log.warning("RSS %s failed: %s", feed_name, e)
    return deals


def _parse_rss_deal(entry: dict, source: str, origin: str) -> Deal | None:
    """Extract a deal from an RSS entry."""
    title = entry.get("title", "")
    link = entry.get("link", "")

    price_match = re.search(r"\$(\d[\d,]*)", title)
    if not price_match:
        return None
    price = float(price_match.group(1).replace(",", ""))

    dest_city = _extract_destination(title)
    if not dest_city:
        return None

    # Check relevance — deals from US cities or explicitly mentioning Austin
    title_lower = title.lower()
    relevant_origins = {"austin", "aus", "texas", "dallas", "dfw", "houston", "iah",
                        "san antonio", "sat", "los angeles", "new york", "chicago",
                        "miami", "boston", "seattle", "denver", "portland", "atlanta",
                        "phoenix", "minneapolis", "washington"}
    if not any(city in title_lower for city in relevant_origins):
        return None

    total_flights = price * 2
    food_per_day = 40.0
    hotel_est = 120 * 3
    total = total_flights + hotel_est + (food_per_day * 3 * 2)

    if total > 3200:
        return None

    now = datetime.now()
    placeholder = Flight(
        origin=origin, destination="???", depart=now, arrive=now,
        carrier="See link", stops=0, price_usd=price,
        booking_url=link, duration_hours=0,
    )

    return Deal(
        destination_city=dest_city, destination_country="",
        outbound=placeholder, inbound=placeholder,
        hotel=None, food_budget_per_day=food_per_day,
        total_cost=total, highlights=[f"via {source}"],
        source=source,
    )


def _extract_destination(title: str) -> str | None:
    """Best-effort destination extraction from deal title."""
    m = re.search(r"to\s+([A-Z][a-zA-Z\s]+?)(?:\s+for|\s+from|\s*\$)", title)
    if m:
        return m.group(1).strip()
    m = re.search(r"[–—-]\s*([A-Z][a-zA-Z\s]+?)[\.\$]", title)
    if m:
        return m.group(1).strip()
    return None


# ---------------------------------------------------------------------------
# Transfer bonus alerts
# ---------------------------------------------------------------------------


def fetch_transfer_bonus_alerts() -> list[dict]:
    """Check Frequent Miler RSS for Chase transfer bonus posts."""
    alerts = []
    for feed_name, feed_url in POINTS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:10]:
                title = entry.get("title", "").lower()
                if any(kw in title for kw in ["transfer bonus", "chase", "ultimate rewards"]):
                    alerts.append({
                        "source": feed_name,
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                    })
        except Exception as e:
            log.warning("Points feed %s failed: %s", feed_name, e)
    return alerts


# ---------------------------------------------------------------------------
# Cost estimators
# ---------------------------------------------------------------------------


def _parse_flight_time(time_str: str, fallback_date: date) -> datetime:
    """Parse '11:01 AM on Thu, Apr 16' into a datetime."""
    try:
        m = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", time_str)
        if m:
            t = datetime.strptime(m.group(1).strip(), "%I:%M %p").time()
            return datetime.combine(fallback_date, t)
    except Exception:
        pass
    return datetime.combine(fallback_date, datetime.min.time().replace(hour=12))


def _estimate_food_budget(country: str) -> float:
    cheap = {"Mexico", "Colombia", "Peru", "Thailand", "Vietnam", "Indonesia",
             "India", "Turkey", "Portugal", "Greece", "Czech Republic", "Hungary",
             "Poland", "Guatemala", "Costa Rica", "Ecuador", "Taiwan", "Cuba"}
    mid = {"United States", "Canada", "Spain", "Italy", "Germany", "France",
           "United Kingdom", "Japan", "South Korea", "Australia", "Netherlands",
           "Austria", "Belgium", "Ireland", "New Zealand", "Puerto Rico",
           "Denmark", "Iceland", "Singapore"}
    if country in cheap:
        return 25.0
    elif country in mid:
        return 50.0
    return 40.0


def _estimate_hotel_cost(country: str, nights: int) -> float:
    cheap = {"Mexico", "Colombia", "Peru", "Thailand", "Vietnam", "Indonesia",
             "India", "Turkey", "Portugal", "Greece", "Czech Republic", "Hungary",
             "Poland", "Guatemala", "Costa Rica", "Ecuador", "Taiwan", "Cuba"}
    expensive = {"Japan", "United Kingdom", "France", "Switzerland", "Norway",
                 "Australia", "New Zealand", "Iceland", "Denmark", "Singapore"}
    if country in cheap:
        return 60 * nights
    elif country in expensive:
        return 180 * nights
    return 120 * nights
