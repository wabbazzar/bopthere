"""Data models for travel deals."""

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Flight:
    origin: str
    destination: str
    depart: datetime
    arrive: datetime
    carrier: str
    stops: int
    price_usd: float  # total for all passengers (round trip)
    booking_url: str
    duration_hours: float


@dataclass
class Hotel:
    name: str
    city: str
    checkin: date
    checkout: date
    price_per_night: float
    total_price: float
    stars: float | None = None
    booking_url: str = ""


# Chase Sapphire hotel partners — earn/redeem points here
CHASE_HOTEL_PARTNERS = {
    "Hyatt": "Best UR transfer value (1:1, typically 2-4 cpp)",
    "IHG": "Chase IHG card earns bonus points",
    "Marriott": "Transfer from UR at 1:1",
}


@dataclass
class Deal:
    destination_city: str
    destination_country: str
    outbound: Flight
    inbound: Flight
    hotel: Hotel | None
    food_budget_per_day: float  # estimated
    total_cost: float  # 2 people: flights + hotel + food
    score: float = 0.0
    highlights: list[str] = field(default_factory=list)
    source: str = ""
    search_date: date = field(default_factory=date.today)
    typical_flight_price: float = 0.0  # typical price for comparison

    @property
    def nights(self) -> int:
        return (self.inbound.depart.date() - self.outbound.arrive.date()).days

    @property
    def flight_cost_total(self) -> float:
        # price_usd is already total for all passengers
        return self.outbound.price_usd + self.inbound.price_usd

    @property
    def savings(self) -> float:
        if self.typical_flight_price > 0:
            return self.typical_flight_price - self.flight_cost_total
        return 0

    def summary(self) -> str:
        """Format deal for Signal message."""
        stops_str = "nonstop" if self.outbound.stops == 0 else f"{self.outbound.stops} stop"
        dur_str = f"{self.outbound.duration_hours:.0f}h" if self.outbound.duration_hours else ""
        flight_info = f"{self.outbound.carrier}, {stops_str}"
        if dur_str:
            flight_info += f", {dur_str}"

        country = f", {self.destination_country}" if self.destination_country else ""
        dep_time = self.outbound.depart.strftime("%-I:%M%p").lower()

        hotel_cost = self._hotel_estimate
        food_cost = self.food_budget_per_day * self.nights * 2

        lines = [
            f"✈️ {self.destination_city}{country}",
            f"📅 {self.outbound.depart.strftime('%a %b %-d')} → {self.inbound.depart.strftime('%a %b %-d')} ({self.nights} nights)",
            f"💰 ${self.total_cost:.0f} total for 2",
            f"   • Flights: ${self.flight_cost_total:.0f}",
        ]

        # Show savings vs typical price
        if self.typical_flight_price > 0 and self.savings > 0:
            lines.append(f"   • Typical: ${self.typical_flight_price:.0f} (saving ${self.savings:.0f})")

        lines.extend([
            f"   • Hotel: ~${hotel_cost:.0f}",
            f"   • Food: ~${food_cost:.0f}",
            "",
            f"🛫 {flight_info}",
            f"⏰ Departs {dep_time}",
        ])

        # Hotel suggestion
        hotel_url = (
            f"https://www.google.com/travel/hotels/{self.destination_city}"
            f"?q=hotels+in+{self.destination_city.replace(' ', '+')}"
            f"&dates={self.outbound.depart.strftime('%Y-%m-%d')}"
            f"/{self.inbound.depart.strftime('%Y-%m-%d')}"
        )
        lines.extend([
            "",
            f"🏨 Book Hyatt/IHG for Chase points",
            f"   {hotel_url}",
        ])

        # Highlights
        if self.highlights:
            tags = [h for h in self.highlights if h not in ["cheaper than usual", "low price"]]
            if tags:
                lines.extend(["", f"✨ {', '.join(tags)}"])

        lines.extend([
            "",
            f"🔗 Flights: {self.outbound.booking_url}",
        ])

        return "\n".join(lines)

    @property
    def _hotel_estimate(self) -> float:
        return self.total_cost - self.flight_cost_total - (self.food_budget_per_day * self.nights * 2)
