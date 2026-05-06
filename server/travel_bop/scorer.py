"""Score and rank deals based on preferences and feedback history."""

import logging

from .db import get_feedback_summary, get_sent_destinations
from .models import Deal

log = logging.getLogger("travel-bop")

# Seed preferences — these get adjusted by feedback over time
PREFERRED_VIBES = {"hiking", "culture", "food", "art"}

# Destinations known for hiking/culture/art/food
DESTINATION_TAGS = {
    "Mexico City": {"culture", "food", "art"},
    "Oaxaca": {"culture", "food", "art"},
    "San Miguel de Allende": {"culture", "art", "food"},
    "Guanajuato": {"culture", "art"},
    "Mérida": {"culture", "food"},
    "Bogotá": {"culture", "food", "art"},
    "Medellín": {"culture", "food", "hiking"},
    "Lima": {"culture", "food"},
    "Cusco": {"culture", "hiking"},
    "Lisbon": {"culture", "food", "art"},
    "Porto": {"culture", "food"},
    "Barcelona": {"culture", "food", "art"},
    "Madrid": {"culture", "food", "art"},
    "Tokyo": {"culture", "food", "art"},
    "Kyoto": {"culture", "food", "art", "hiking"},
    "Seoul": {"culture", "food"},
    "Taipei": {"culture", "food", "hiking"},
    "Istanbul": {"culture", "food", "art"},
    "Prague": {"culture", "art", "food"},
    "Budapest": {"culture", "food", "art"},
    "Vienna": {"culture", "art", "food"},
    "Berlin": {"culture", "art", "food"},
    "Amsterdam": {"culture", "art", "food"},
    "Copenhagen": {"culture", "food", "art"},
    "Reykjavik": {"hiking", "culture"},
    "Banff": {"hiking"},
    "Vancouver": {"culture", "food", "hiking"},
    "Montreal": {"culture", "food", "art"},
    "Santa Fe": {"culture", "art", "food", "hiking"},
    "Sedona": {"hiking", "art"},
    "Asheville": {"food", "art", "hiking"},
    "Portland": {"food", "art", "culture"},
    "Denver": {"hiking", "culture", "food"},
    "San Francisco": {"culture", "food", "art"},
    "New Orleans": {"culture", "food", "art"},
    "Savannah": {"culture", "food", "art"},
    "Chicago": {"culture", "food", "art"},
    "New York": {"culture", "food", "art"},
}


def score_deal(deal: Deal, conn=None) -> float:
    """Score a deal 0-100 based on preferences and feedback."""
    score = 50.0  # baseline

    # Budget fit: deals well under budget score higher
    budget = 3000
    if deal.total_cost <= budget:
        savings_pct = (budget - deal.total_cost) / budget
        score += savings_pct * 20  # up to +20 for great value
    else:
        over_pct = (deal.total_cost - budget) / budget
        score -= over_pct * 40  # penalize heavily for over budget

    # Destination vibe match
    city = deal.destination_city
    tags = DESTINATION_TAGS.get(city, set())
    if tags:
        overlap = len(tags & PREFERRED_VIBES)
        score += overlap * 8  # up to +32 for 4/4 match
        deal.highlights.extend(sorted(tags & PREFERRED_VIBES))
    else:
        # Unknown destination — slight penalty but not terrible
        score -= 5

    # Fewer stops = better
    total_stops = deal.outbound.stops + deal.inbound.stops
    if total_stops == 0:
        score += 10
        deal.highlights.append("direct flights")
    elif total_stops <= 2:
        score += 5

    # Penalize recently sent destinations
    if conn:
        recent = get_sent_destinations(conn, days=14)
        if city in recent:
            score -= 30  # strongly avoid repeats

        # Boost destinations similar to liked ones
        feedback = get_feedback_summary(conn)
        liked_destinations = {d["destination"].split(",")[0].strip() for d in feedback["liked"]}
        disliked_destinations = {d["destination"].split(",")[0].strip() for d in feedback["disliked"]}

        if city in disliked_destinations:
            score -= 25
        if city in liked_destinations:
            score += 10  # slight boost for liked places (but variety matters too)

        # Boost countries of liked destinations
        liked_countries = {d["destination"].split(",")[-1].strip() for d in feedback["liked"]}
        if deal.destination_country in liked_countries:
            score += 5

    deal.score = max(0, min(100, score))
    return deal.score


def rank_deals(deals: list[Deal], conn=None) -> list[Deal]:
    """Score all deals and return sorted best-first."""
    for deal in deals:
        score_deal(deal, conn)

    # Filter out over-budget deals
    within_budget = [d for d in deals if d.total_cost <= 3200]  # small buffer
    within_budget.sort(key=lambda d: d.score, reverse=True)
    return within_budget
